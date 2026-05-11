// `agentlint login` — RFC 8628 (OAuth Device Authorization Grant) flow
// against the agentlint.sh web server.
//
// Flow:
//   1. POST /api/cli/auth/device  -> { device_code, user_code, ... }
//   2. Tell the user to open verification_uri_complete in a browser
//      (and try to open it automatically when running on a TTY).
//   3. POST /api/cli/auth/poll every `interval` seconds. On `approved`,
//      receive a project token + project metadata and write the token to
//      ~/.config/agentlint/token.
//
// The function is pure-ish — all IO is injected so tests are deterministic.
// Network failures, expired grants, denied grants, and slow_down rate-limits
// each map to a discriminated outcome the caller renders.
//
// Local-first invariant (CHARTER §3): this is the only network call the CLI
// makes by default. The hot path `agentlint .` does not touch it.

import { writeTokenFile as realWriteTokenFile } from "./token-file.js";

const DEVICE_PATH = "/api/cli/auth/device";
const POLL_PATH = "/api/cli/auth/poll";
const DEFAULT_ENDPOINT = "https://agentlint.sh";
const DEFAULT_INTERVAL_SECONDS = 5;
const DEFAULT_EXPIRES_SECONDS = 600;
const REQUEST_TIMEOUT_MS = 15_000;

export interface LoginFlags {
  /** `--endpoint <url>` — overrides AGENTLINT_URL/default. */
  endpoint?: string;
  /** `--no-browser` — don't try to open the verification URI. */
  noBrowser?: boolean;
}

export interface LoginProject {
  id: string;
  orgSlug: string;
}

export type LoginOutcome =
  | { kind: "success"; token: string; project: LoginProject }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "network-error"; reason: string };

export type FetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type SleepFn = (ms: number) => Promise<void>;

export type OpenBrowserFn = (url: string) => Promise<void>;

export type WriteTokenFileFn = (token: string) => Promise<void>;

export type GetEnvFn = (name: string) => string | undefined;

export type LogFn = (line: string) => void;

export interface LoginDeps {
  log: LogFn;
  fetchFn?: FetchFn;
  openBrowser?: OpenBrowserFn;
  sleep?: SleepFn;
  writeTokenFile?: WriteTokenFileFn;
  getEnv?: GetEnvFn;
  /** Override endpoint for tests; if provided, flags.endpoint still wins. */
  endpoint?: string;
  /** Override CLI version embedded in the `client_name` payload. */
  clientVersion?: string;
  /** Override the "now" clock for expiry math. */
  now?: () => number;
}

interface DeviceResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  interval: number;
  expires_in: number;
}

interface PollResponse {
  status?: "pending" | "approved" | "denied" | "expired";
  token?: string;
  project?: { id?: string; orgSlug?: string };
  error?: string;
}

function resolveEndpoint(flags: LoginFlags, deps: LoginDeps): string {
  if (flags.endpoint && flags.endpoint.length > 0) return flags.endpoint;
  if (deps.endpoint && deps.endpoint.length > 0) return deps.endpoint;
  const getEnv = deps.getEnv ?? ((n: string) => process.env[n]);
  const fromEnv = getEnv("AGENTLINT_URL");
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  return DEFAULT_ENDPOINT;
}

function buildEndpointUrl(base: string, path: string): string | null {
  try {
    const u = new URL(base);
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

async function postJson(
  fetchFn: FetchFn,
  url: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: unknown } | { error: string }> {
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "agentlint-cli (+https://agentlint.sh)",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

function normalizeDeviceResponse(payload: unknown): DeviceResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const device_code =
    typeof obj.device_code === "string" ? obj.device_code : "";
  const user_code = typeof obj.user_code === "string" ? obj.user_code : "";
  const verification_uri =
    typeof obj.verification_uri === "string" ? obj.verification_uri : "";
  const verification_uri_complete =
    typeof obj.verification_uri_complete === "string"
      ? obj.verification_uri_complete
      : verification_uri;
  const interval =
    typeof obj.interval === "number" && obj.interval > 0
      ? obj.interval
      : DEFAULT_INTERVAL_SECONDS;
  const expires_in =
    typeof obj.expires_in === "number" && obj.expires_in > 0
      ? obj.expires_in
      : DEFAULT_EXPIRES_SECONDS;
  if (!device_code || !user_code || !verification_uri) return null;
  return {
    device_code,
    user_code,
    verification_uri,
    verification_uri_complete,
    interval,
    expires_in,
  };
}

function normalizePollPayload(payload: unknown): PollResponse {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as Record<string, unknown>;
  const out: PollResponse = {};
  if (
    obj.status === "pending" ||
    obj.status === "approved" ||
    obj.status === "denied" ||
    obj.status === "expired"
  ) {
    out.status = obj.status;
  }
  if (typeof obj.token === "string") out.token = obj.token;
  if (obj.project && typeof obj.project === "object") {
    const p = obj.project as Record<string, unknown>;
    out.project = {
      id: typeof p.id === "string" ? p.id : undefined,
      orgSlug: typeof p.orgSlug === "string" ? p.orgSlug : undefined,
    };
  }
  if (typeof obj.error === "string") out.error = obj.error;
  return out;
}

/**
 * Run the device-flow login. Returns a discriminated outcome the caller
 * formats — `runLogin` never throws.
 */
export async function runLogin(
  flags: LoginFlags,
  deps: LoginDeps,
): Promise<LoginOutcome> {
  const fetchFn = deps.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => Date.now());
  const writeFn = deps.writeTokenFile ?? realWriteTokenFile;
  const endpoint = resolveEndpoint(flags, deps);
  const clientName = `agentlint-cli/${deps.clientVersion ?? "2.2.0"}`;

  const deviceUrl = buildEndpointUrl(endpoint, DEVICE_PATH);
  const pollUrl = buildEndpointUrl(endpoint, POLL_PATH);
  if (!deviceUrl || !pollUrl) {
    return {
      kind: "network-error",
      reason: `invalid endpoint URL: ${endpoint}`,
    };
  }

  const start = await postJson(fetchFn, deviceUrl, { client_name: clientName });
  if ("error" in start) {
    return { kind: "network-error", reason: start.error };
  }
  if (start.status !== 200) {
    return {
      kind: "network-error",
      reason: `device endpoint returned status ${start.status}`,
    };
  }
  const device = normalizeDeviceResponse(start.data);
  if (!device) {
    return { kind: "network-error", reason: "invalid device-flow response" };
  }

  deps.log("Open this URL in your browser:");
  deps.log(`  ${device.verification_uri_complete}`);
  deps.log("");
  deps.log(`Or enter the code manually at ${device.verification_uri}`);
  deps.log(`Code: ${device.user_code}`);
  deps.log("");

  if (!flags.noBrowser && deps.openBrowser) {
    try {
      await deps.openBrowser(device.verification_uri_complete);
    } catch {
      // Best effort — the user still has the URL in the terminal.
    }
  }

  deps.log("Waiting for authorization...");

  const deadline = now() + device.expires_in * 1000;
  let intervalSeconds = device.interval;

  while (now() < deadline) {
    await sleep(intervalSeconds * 1000);

    const poll = await postJson(fetchFn, pollUrl, {
      device_code: device.device_code,
    });
    if ("error" in poll) {
      return { kind: "network-error", reason: poll.error };
    }

    const data = normalizePollPayload(poll.data);

    if (poll.status === 200) {
      if (data.status === "approved") {
        const token = data.token;
        const projectId = data.project?.id;
        const orgSlug = data.project?.orgSlug;
        if (!token || !projectId || !orgSlug) {
          return {
            kind: "network-error",
            reason: "approved response missing token or project",
          };
        }
        try {
          await writeFn(token);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            kind: "network-error",
            reason: `failed to write token file: ${msg}`,
          };
        }
        deps.log("");
        deps.log("✓ Authorized. Token saved to ~/.config/agentlint/token.");
        return {
          kind: "success",
          token,
          project: { id: projectId, orgSlug },
        };
      }
      if (data.status === "denied") return { kind: "denied" };
      if (data.status === "expired") return { kind: "expired" };
      // status === "pending" or unknown -> keep polling.
      continue;
    }

    if (poll.status === 400) {
      if (data.error === "expired_token") return { kind: "expired" };
      if (data.error === "access_denied") return { kind: "denied" };
      return {
        kind: "network-error",
        reason: `bad request: ${data.error ?? "unknown"}`,
      };
    }

    if (poll.status === 429) {
      // slow_down — double the interval and keep polling.
      intervalSeconds = intervalSeconds * 2;
      continue;
    }

    if (poll.status === 404) {
      // grant_redeemed — treat as expired so the user runs login again.
      return { kind: "expired" };
    }

    if (poll.status >= 500) {
      return {
        kind: "network-error",
        reason: `server error ${poll.status}`,
      };
    }

    return {
      kind: "network-error",
      reason: `unexpected status ${poll.status}`,
    };
  }

  return { kind: "expired" };
}
