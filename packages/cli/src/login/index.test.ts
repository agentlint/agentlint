import { describe, expect, it, vi } from "vitest";
import type { FetchFn, LoginDeps } from "./index.js";
import { runLogin } from "./index.js";

interface MockFetchCall {
  url: string;
  body: unknown;
}

interface MockResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

function makeFetch(responses: MockResponse[]): {
  fetchFn: FetchFn;
  calls: MockFetchCall[];
} {
  const calls: MockFetchCall[] = [];
  const queue = [...responses];
  const fetchFn: FetchFn = async (url, init) => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(init.body);
    } catch {
      parsed = init.body;
    }
    calls.push({ url, body: parsed });
    const next = queue.shift();
    if (!next) {
      throw new Error(`unexpected extra fetch: ${url}`);
    }
    return {
      ok: next.ok,
      status: next.status,
      json: async () => next.body,
    };
  };
  return { fetchFn, calls };
}

function makeDeps(overrides: Partial<LoginDeps> & Pick<LoginDeps, "fetchFn">): {
  deps: LoginDeps;
  logs: string[];
  written: string[];
  sleeps: number[];
  browserCalls: string[];
} {
  const logs: string[] = [];
  const written: string[] = [];
  const sleeps: number[] = [];
  const browserCalls: string[] = [];
  const deps: LoginDeps = {
    log: (l) => logs.push(l),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    writeTokenFile: async (t) => {
      written.push(t);
    },
    openBrowser: async (u) => {
      browserCalls.push(u);
    },
    getEnv: () => undefined,
    clientVersion: "2.2.0",
    now: () => 1000,
    ...overrides,
  };
  return { deps, logs, written, sleeps, browserCalls };
}

const DEVICE_OK: MockResponse = {
  ok: true,
  status: 200,
  body: {
    device_code: "d".repeat(64),
    user_code: "ABCD-1234",
    verification_uri: "http://localhost:3000/cli/auth",
    verification_uri_complete:
      "http://localhost:3000/cli/auth?user_code=ABCD-1234",
    interval: 5,
    expires_in: 600,
  },
};

describe("runLogin", () => {
  it("returns success after pending → approved poll cycle", async () => {
    const { fetchFn, calls } = makeFetch([
      DEVICE_OK,
      { ok: true, status: 200, body: { status: "pending" } },
      {
        ok: true,
        status: 200,
        body: {
          status: "approved",
          token: "agl_proj_abc",
          project: { id: "proj_1", orgSlug: "acme" },
        },
      },
    ]);
    const { deps, logs, written, sleeps, browserCalls } = makeDeps({ fetchFn });

    const out = await runLogin({ endpoint: "http://localhost:3000" }, deps);

    expect(out.kind).toBe("success");
    if (out.kind === "success") {
      expect(out.token).toBe("agl_proj_abc");
      expect(out.project).toEqual({ id: "proj_1", orgSlug: "acme" });
    }
    expect(written).toEqual(["agl_proj_abc"]);
    expect(sleeps).toEqual([5000, 5000]);
    expect(browserCalls).toEqual([
      "http://localhost:3000/cli/auth?user_code=ABCD-1234",
    ]);
    expect(logs.join("\n")).toContain("ABCD-1234");
    expect(logs.join("\n")).toContain("Authorized");
    expect(calls).toHaveLength(3);
    expect(calls[0]?.url).toBe("http://localhost:3000/api/cli/auth/device");
    expect(calls[1]?.url).toBe("http://localhost:3000/api/cli/auth/poll");
    expect((calls[0]?.body as Record<string, unknown>).client_name).toBe(
      "agentlint-cli/2.2.0",
    );
  });

  it("returns expired when poll returns 400 expired_token", async () => {
    const { fetchFn } = makeFetch([
      DEVICE_OK,
      { ok: false, status: 400, body: { error: "expired_token" } },
    ]);
    const { deps, written } = makeDeps({ fetchFn });

    const out = await runLogin({ endpoint: "http://localhost:3000" }, deps);
    expect(out.kind).toBe("expired");
    expect(written).toEqual([]);
  });

  it("returns denied when poll returns 400 access_denied", async () => {
    const { fetchFn } = makeFetch([
      DEVICE_OK,
      { ok: false, status: 400, body: { error: "access_denied" } },
    ]);
    const { deps, written } = makeDeps({ fetchFn });

    const out = await runLogin({ endpoint: "http://localhost:3000" }, deps);
    expect(out.kind).toBe("denied");
    expect(written).toEqual([]);
  });

  it("doubles the poll interval on 429 slow_down and continues", async () => {
    const { fetchFn } = makeFetch([
      DEVICE_OK,
      { ok: false, status: 429, body: { error: "slow_down" } },
      {
        ok: true,
        status: 200,
        body: {
          status: "approved",
          token: "agl_proj_xyz",
          project: { id: "proj_1", orgSlug: "acme" },
        },
      },
    ]);
    const { deps, sleeps } = makeDeps({ fetchFn });

    const out = await runLogin({ endpoint: "http://localhost:3000" }, deps);
    expect(out.kind).toBe("success");
    expect(sleeps).toEqual([5000, 10000]);
  });

  it("returns network-error when fetch throws", async () => {
    const fetchFn: FetchFn = async () => {
      throw new Error("ENOTFOUND");
    };
    const { deps } = makeDeps({ fetchFn });

    const out = await runLogin({ endpoint: "http://localhost:3000" }, deps);
    expect(out.kind).toBe("network-error");
    if (out.kind === "network-error") {
      expect(out.reason).toContain("ENOTFOUND");
    }
  });

  it("does not open the browser when --no-browser is set", async () => {
    const { fetchFn } = makeFetch([
      DEVICE_OK,
      {
        ok: true,
        status: 200,
        body: {
          status: "approved",
          token: "agl_proj_xyz",
          project: { id: "proj_1", orgSlug: "acme" },
        },
      },
    ]);
    const { deps, browserCalls } = makeDeps({ fetchFn });

    const out = await runLogin(
      { endpoint: "http://localhost:3000", noBrowser: true },
      deps,
    );
    expect(out.kind).toBe("success");
    expect(browserCalls).toEqual([]);
  });

  it("expires when the deadline passes before approval", async () => {
    // Device says interval=1s, expires_in=2s. Two polls of pending and then
    // the next now() call exceeds the deadline.
    let nowValue = 0;
    const { fetchFn } = makeFetch([
      {
        ok: true,
        status: 200,
        body: {
          device_code: "d",
          user_code: "U",
          verification_uri: "http://localhost:3000/cli/auth",
          verification_uri_complete:
            "http://localhost:3000/cli/auth?user_code=U",
          interval: 1,
          expires_in: 2,
        },
      },
      { ok: true, status: 200, body: { status: "pending" } },
      { ok: true, status: 200, body: { status: "pending" } },
    ]);
    const { deps } = makeDeps({
      fetchFn,
      now: () => nowValue,
      sleep: async (ms) => {
        nowValue += ms;
      },
    });

    const out = await runLogin({ endpoint: "http://localhost:3000" }, deps);
    expect(out.kind).toBe("expired");
  });

  it("returns network-error when device endpoint returns non-200", async () => {
    const { fetchFn } = makeFetch([
      { ok: false, status: 500, body: { error: "boom" } },
    ]);
    const { deps } = makeDeps({ fetchFn });

    const out = await runLogin({ endpoint: "http://localhost:3000" }, deps);
    expect(out.kind).toBe("network-error");
  });

  it("returns network-error when approved payload is missing token", async () => {
    const { fetchFn } = makeFetch([
      DEVICE_OK,
      {
        ok: true,
        status: 200,
        body: { status: "approved", project: { id: "p" } },
      },
    ]);
    const { deps, written } = makeDeps({ fetchFn });

    const out = await runLogin({ endpoint: "http://localhost:3000" }, deps);
    expect(out.kind).toBe("network-error");
    expect(written).toEqual([]);
  });

  it("calls openBrowser with the verification URI", async () => {
    const openBrowser = vi.fn(async () => {});
    const { fetchFn } = makeFetch([
      DEVICE_OK,
      {
        ok: true,
        status: 200,
        body: {
          status: "approved",
          token: "agl_proj_a",
          project: { id: "p", orgSlug: "s" },
        },
      },
    ]);
    const { deps } = makeDeps({ fetchFn, openBrowser });

    await runLogin({ endpoint: "http://localhost:3000" }, deps);
    expect(openBrowser).toHaveBeenCalledWith(
      "http://localhost:3000/cli/auth?user_code=ABCD-1234",
    );
  });
});
