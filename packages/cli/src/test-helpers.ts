import type { ProjectMeta, ScanContext } from "@agentlinthq/core";

interface MockOpts {
  files?: Record<string, string>;
  url?: string;
  meta?: Partial<ProjectMeta>;
}

const defaultMeta: ProjectMeta = {
  packageManager: "npm",
  isMonorepo: false,
  workspaces: [],
  language: "typescript",
  hasCi: false,
  ciFiles: [],
  manifest: null,
};

export function mockCtx(opts: MockOpts = {}): ScanContext {
  const files = opts.files ?? {};
  return {
    root: "/mock",
    url: opts.url,
    async read(p) {
      return p in files ? files[p] : null;
    },
    async exists(p) {
      return p in files;
    },
    async glob(pattern) {
      // Very simple glob: support 'a/*/b' and exact paths only.
      const keys = Object.keys(files);
      if (!pattern.includes("*")) return keys.filter((k) => k === pattern);
      // Convert simple glob to regex
      const re = new RegExp(
        "^" +
          pattern
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/]*") +
          "$",
      );
      return keys.filter((k) => re.test(k));
    },
    meta: { ...defaultMeta, ...(opts.meta ?? {}) },
  };
}
