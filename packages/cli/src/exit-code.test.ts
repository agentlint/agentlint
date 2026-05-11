// Unit tests for the resolveExitCode helper extracted from src/index.ts.
//
// Policy fails (exit 2) take precedence over score regressions (exit 1) so
// CI can tell them apart. See PROJECT_STATE slice notes for the contract.

import { describe, expect, it } from "vitest";
import { resolveExitCode } from "./index.js";

describe("resolveExitCode", () => {
  it("returns 0 on a passing score with no policy", () => {
    expect(resolveExitCode(100, 0)).toBe(0);
    expect(resolveExitCode(80, 0)).toBe(0);
  });

  it("returns 1 when score is below the agentlint 80 threshold", () => {
    expect(resolveExitCode(79, 0)).toBe(1);
    expect(resolveExitCode(0, 0)).toBe(1);
  });

  it("returns the policy exit code when push enforced a policy", () => {
    expect(resolveExitCode(95, 2)).toBe(2);
  });

  it("prefers the policy exit code over the score regression code", () => {
    // Both fail — policy wins so users get the actionable signal.
    expect(resolveExitCode(50, 2)).toBe(2);
  });

  it("returns 0 when policyExit is 0 even on a high score", () => {
    expect(resolveExitCode(100, 0)).toBe(0);
  });
});
