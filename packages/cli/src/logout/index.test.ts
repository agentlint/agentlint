import { describe, expect, it } from "vitest";
import { runLogout } from "./index.js";

describe("runLogout", () => {
  it("removes the token file when present", async () => {
    const logs: string[] = [];
    const out = await runLogout({
      log: (l) => logs.push(l),
      unlinkTokenFile: async () => true,
    });
    expect(out.kind).toBe("removed");
    expect(logs.join("\n")).toContain("Removed");
  });

  it("reports not-found when no token file exists", async () => {
    const logs: string[] = [];
    const out = await runLogout({
      log: (l) => logs.push(l),
      unlinkTokenFile: async () => false,
    });
    expect(out.kind).toBe("not-found");
    expect(logs.join("\n")).toContain("No token file");
  });
});
