// Public types for agentlint rules and reports.
// The core package is IO-free — rules pass a ScanContext that carries
// cached file reads and detected project metadata.

export type Category =
  | "discoverability"
  | "buildability"
  | "conventions"
  | "documentation"
  | "safety";

export type Status = "pass" | "fail" | "warn" | "skip";

export interface RuleMeta {
  id: string;
  category: Category;
  weight: number;
  fixable: boolean;
  description: string;
}

export interface Result {
  ruleId: string;
  status: Status;
  /** points awarded; 0 to RuleMeta.weight, or null if skipped */
  points: number | null;
  /** one-line human message */
  message: string;
  /** optional fix recipe shown in the report */
  fix?: {
    summary: string;
    diff?: string;
    docsUrl?: string;
  };
}

export interface ProjectMeta {
  packageManager:
    | "npm"
    | "pnpm"
    | "bun"
    | "yarn"
    | "pip"
    | "uv"
    | "cargo"
    | "go"
    | "unknown";
  isMonorepo: boolean;
  workspaces: string[];
  language:
    | "typescript"
    | "javascript"
    | "python"
    | "rust"
    | "go"
    | "mixed"
    | "unknown";
  hasCi: boolean;
  ciFiles: string[];
  /** parsed package manifest (package.json, pyproject.toml, etc) if any */
  manifest: Record<string, unknown> | null;
}

export interface ScanContext {
  /** absolute path to the repo root being scanned */
  root: string;
  /** if --url was passed, the docs URL to audit */
  url?: string;
  /** cached file reads — relative path */
  read(relPath: string): Promise<string | null>;
  /** does a path exist? cached */
  exists(relPath: string): Promise<boolean>;
  /** glob match relative to repo root, cached */
  glob(pattern: string): Promise<string[]>;
  /** detected project metadata */
  meta: ProjectMeta;
}

export type Rule = {
  meta: RuleMeta;
  check(ctx: ScanContext): Promise<Result>;
};

export interface CategoryScore {
  category: Category;
  earned: number;
  possible: number;
}

export interface Report {
  version: string;
  scannedAt: string;
  root: string;
  url?: string;
  results: Result[];
  byCategory: CategoryScore[];
  rawScore: { earned: number; possible: number };
  /** normalized 0–100 */
  score: number;
}
