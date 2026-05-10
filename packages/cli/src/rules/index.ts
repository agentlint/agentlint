import type { Rule } from "@agentlinthq/core";
import { buildabilityRules } from "./buildability.js";
import { conventionsRules } from "./conventions.js";
import { discoverabilityRules } from "./discoverability.js";
import { documentationRules } from "./documentation.js";
import { safetyRules } from "./safety.js";

export const allRules: Rule[] = [
  ...discoverabilityRules,
  ...buildabilityRules,
  ...conventionsRules,
  ...documentationRules,
  ...safetyRules,
];
