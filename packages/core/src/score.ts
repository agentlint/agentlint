import type { Category, CategoryScore, Report, Result } from "./types.js";

const CATEGORY_MAX: Record<Category, number> = {
  discoverability: 25,
  buildability: 25,
  conventions: 20,
  documentation: 15,
  safety: 15,
};

// Set by the CLI runner before calling buildReport.
const ruleCategories = new Map<string, Category>();

export function registerRuleCategory(id: string, category: Category): void {
  ruleCategories.set(id, category);
}

export function getCategoryMax(category: Category): number {
  return CATEGORY_MAX[category];
}

export function buildReport(args: {
  version: string;
  root: string;
  url?: string;
  results: Result[];
}): Report {
  const { version, root, url, results } = args;

  const byCategory: CategoryScore[] = [];
  let totalEarned = 0;
  let totalPossible = 0;

  for (const category of Object.keys(CATEGORY_MAX) as Category[]) {
    const inCat = results.filter(
      (r) => ruleCategories.get(r.ruleId) === category,
    );

    if (inCat.length === 0) {
      // No rules registered for this category; skip.
      byCategory.push({ category, earned: 0, possible: 0 });
      continue;
    }

    const allSkipped = inCat.every((r) => r.status === "skip");
    if (allSkipped) {
      byCategory.push({ category, earned: 0, possible: 0 });
      continue;
    }

    const earned = inCat.reduce((s, r) => s + (r.points ?? 0), 0);
    const possible = CATEGORY_MAX[category];
    byCategory.push({ category, earned, possible });
    totalEarned += earned;
    totalPossible += possible;
  }

  const score =
    totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

  return {
    version,
    scannedAt: new Date().toISOString(),
    root,
    url,
    results,
    byCategory,
    rawScore: { earned: totalEarned, possible: totalPossible },
    score,
  };
}
