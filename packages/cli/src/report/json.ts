import type { Report } from "@agentlinthq/core";

export function renderJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
