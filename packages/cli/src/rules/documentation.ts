import type { Rule } from "@agentlinthq/core";
import { fail, pass, skip, warn } from "./_helpers.js";

/**
 * The documentation category fetches public URLs. We use Node's built-in fetch
 * (Node 18+). All HTTP failures are graceful skips, never crashes.
 */
async function safeFetch(
  url: string,
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "agentlint/1.0 (+https://agentlint.dev)" },
      signal: AbortSignal.timeout(8000),
    });
    const text = r.ok ? await r.text() : "";
    return { ok: r.ok, status: r.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

function rootOf(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

export const llmsTxtPresent: Rule = {
  meta: {
    id: "llms-txt-present",
    category: "documentation",
    weight: 4,
    fixable: true,
    description: "llms.txt exists at the docs root.",
  },
  async check(ctx) {
    if (!ctx.url) return skip("llms-txt-present", "No --url provided.");
    const root = rootOf(ctx.url);
    const r = await safeFetch(`${root}/llms.txt`);
    if (r.ok && r.text.trim().length > 0)
      return pass("llms-txt-present", 4, `llms.txt found at ${root}/llms.txt.`);
    return fail("llms-txt-present", "llms.txt not found at docs root.", {
      summary:
        "Add an llms.txt at the root of your docs site listing your most important pages in markdown.",
      docsUrl: "https://llmstxt.org/",
    });
  },
};

export const llmsFullOrMdMirrors: Rule = {
  meta: {
    id: "llms-full-or-md-mirrors",
    category: "documentation",
    weight: 3,
    fixable: false,
    description: "llms-full.txt or per-page .md mirrors are available.",
  },
  async check(ctx) {
    if (!ctx.url) return skip("llms-full-or-md-mirrors", "No --url provided.");
    const root = rootOf(ctx.url);
    const full = await safeFetch(`${root}/llms-full.txt`);
    if (full.ok && full.text.length > 200)
      return pass("llms-full-or-md-mirrors", 3, "llms-full.txt found.");
    // Try a per-page .md mirror by appending .md to the given URL
    const md = await safeFetch(
      ctx.url.endsWith("/") ? `${ctx.url}index.md` : `${ctx.url}.md`,
    );
    if (md.ok && md.text.length > 100)
      return pass("llms-full-or-md-mirrors", 3, "Per-page .md mirror found.");
    return fail(
      "llms-full-or-md-mirrors",
      "Neither llms-full.txt nor per-page .md mirrors detected.",
      {
        summary:
          "Add llms-full.txt with full docs content, or serve .md versions of each page.",
      },
    );
  },
};

export const docsHaveFencedCode: Rule = {
  meta: {
    id: "docs-have-fenced-code",
    category: "documentation",
    weight: 2,
    fixable: false,
    description:
      "Docs include code in fenced blocks, not screenshots or canvas.",
  },
  async check(ctx) {
    if (!ctx.url) return skip("docs-have-fenced-code", "No --url provided.");
    const r = await safeFetch(ctx.url);
    if (!r.ok)
      return skip("docs-have-fenced-code", "Could not fetch docs URL.");
    const hasPre = /<pre[\s>]/.test(r.text) || /<code[\s>]/.test(r.text);
    const isMostlyImages = (r.text.match(/<img/g) ?? []).length > 20 && !hasPre;
    if (hasPre && !isMostlyImages)
      return pass(
        "docs-have-fenced-code",
        2,
        "Docs contain fenced code blocks.",
      );
    return fail(
      "docs-have-fenced-code",
      "Docs page has no `<pre>`/`<code>` blocks; agents cannot extract code.",
      {
        summary:
          "Use real fenced code blocks instead of screenshots or canvas.",
      },
    );
  },
};

export const apiReferenceTextExtractable: Rule = {
  meta: {
    id: "api-reference-text-extractable",
    category: "documentation",
    weight: 2,
    fixable: false,
    description:
      "API reference is text-extractable (HTML, not just SVG/canvas).",
  },
  async check(ctx) {
    if (!ctx.url)
      return skip("api-reference-text-extractable", "No --url provided.");
    const r = await safeFetch(ctx.url);
    if (!r.ok)
      return skip(
        "api-reference-text-extractable",
        "Could not fetch docs URL.",
      );
    const textLen = r.text
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim().length;
    const canvasCount = (r.text.match(/<canvas/g) ?? []).length;
    if (textLen > 1500 && canvasCount < 3)
      return pass(
        "api-reference-text-extractable",
        2,
        "Page is text-extractable.",
      );
    if (canvasCount >= 3)
      return fail(
        "api-reference-text-extractable",
        "Page relies heavily on canvas — agents cannot extract content.",
        { summary: "Render API reference as HTML, not canvas." },
      );
    return warn(
      "api-reference-text-extractable",
      1,
      "Page has very little extractable text.",
      {
        summary: "Increase textual content; avoid SVG/canvas-only references.",
      },
    );
  },
};

export const openapiLinkedFromLlms: Rule = {
  meta: {
    id: "openapi-linked-from-llms",
    category: "documentation",
    weight: 2,
    fixable: false,
    description:
      "OpenAPI/AsyncAPI spec is linked from llms.txt (for API projects).",
  },
  async check(ctx) {
    if (!ctx.url) return skip("openapi-linked-from-llms", "No --url provided.");
    const root = rootOf(ctx.url);
    const r = await safeFetch(`${root}/llms.txt`);
    if (!r.ok)
      return skip("openapi-linked-from-llms", "No llms.txt to inspect.");
    if (
      /openapi/i.test(r.text) ||
      /asyncapi/i.test(r.text) ||
      /\bopenapi\.(json|yaml|yml)\b/.test(r.text)
    ) {
      return pass(
        "openapi-linked-from-llms",
        2,
        "OpenAPI/AsyncAPI link present in llms.txt.",
      );
    }
    return warn(
      "openapi-linked-from-llms",
      1,
      "llms.txt does not link an OpenAPI spec.",
      { summary: "If this is an API, add an OpenAPI link in llms.txt." },
    );
  },
};

export const robotsConsistentWithLlms: Rule = {
  meta: {
    id: "robots-consistent-with-llms",
    category: "documentation",
    weight: 2,
    fixable: false,
    description:
      "robots.txt does not block AI crawlers that llms.txt is meant for.",
  },
  async check(ctx) {
    if (!ctx.url)
      return skip("robots-consistent-with-llms", "No --url provided.");
    const root = rootOf(ctx.url);
    const robots = await safeFetch(`${root}/robots.txt`);
    if (!robots.ok)
      return pass(
        "robots-consistent-with-llms",
        2,
        "No robots.txt — nothing to contradict.",
      );
    const blocksAi =
      /User-agent:\s*(GPTBot|ClaudeBot|PerplexityBot|Anthropic|CCBot|GoogleOther)[\s\S]*?Disallow:\s*\//i.test(
        robots.text,
      );
    if (blocksAi) {
      return fail(
        "robots-consistent-with-llms",
        "robots.txt blocks AI crawlers but you publish llms.txt — contradictory signals.",
        {
          summary:
            "Decide if you want AI access. If yes, allow GPTBot/ClaudeBot/etc; if no, drop llms.txt.",
        },
      );
    }
    return pass(
      "robots-consistent-with-llms",
      2,
      "robots.txt is consistent with llms.txt.",
    );
  },
};

export const documentationRules: Rule[] = [
  llmsTxtPresent,
  llmsFullOrMdMirrors,
  docsHaveFencedCode,
  apiReferenceTextExtractable,
  openapiLinkedFromLlms,
  robotsConsistentWithLlms,
];
