# Security Policy

## Reporting a vulnerability

**Do not file a public GitHub issue for a security vulnerability.**

Use one of these private channels:

1. **GitHub private security advisory** — preferred:
   <https://github.com/agentlint/agentlint/security/advisories/new>
2. **Email**: `security@agentlint.sh` (forwarder being provisioned; until
   it lands, use the GitHub advisory above).

Include in the report:

- Affected version (`agentlint --version`).
- A clear description of the issue.
- Steps to reproduce or a proof-of-concept.
- Your assessment of impact (what an attacker could do).
- Any suggested mitigation.

## Response timeline

- **Acknowledgement:** within 72 hours.
- **Triage:** within 7 days. We'll classify severity (CRITICAL / HIGH /
  MEDIUM / LOW) and tell you whether we accept the report.
- **Fix:** target windows, best-effort:
  - CRITICAL: 7 days.
  - HIGH: 14 days.
  - MEDIUM: 30 days.
  - LOW: next minor release.
- **Disclosure:** after a fix ships, we publish a GitHub Security
  Advisory and credit you (unless you ask to remain anonymous).

The full incident runbook lives at
[`docs/PLAYBOOK.md` § Handling a security disclosure](./docs/PLAYBOOK.md#handling-a-security-disclosure).

## Scope

In scope:

- The published `@agentlinthq/cli` and `@agentlinthq/core` packages.
- The CLI's filesystem walker, scan-context, and rules.
- The reporters (`terminal`, `html`, `json`, `markdown`).
- The published GitHub Action workflow snippets in our docs.

Out of scope (not vulnerabilities for this project):

- Issues in third-party repos that agentlint scans. agentlint is
  read-only against scanned repos; it does not execute their code.
- Score values being "wrong" in your opinion. The score is the score —
  see the [anti-gaming clause in the leaderboard spec](./docs/marketing/leaderboard.md#anti-gaming-clause).
- Denial of service via crafted input to the CLI on your own machine.
  The CLI is local-first; you can't DoS yourself in any meaningful
  sense.
- Vulnerabilities in transitive dependencies that have no exploitable
  path through agentlint's code. Report those upstream.

## Supported versions

agentlint follows semver. We patch the latest minor release of each
supported major.

| Version | Supported |
|---|---|
| 1.x | ✅ |
| < 1.0 | ❌ |

## Safe harbor

Good-faith security research on agentlint is welcome. We will not
pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data
  destruction, or service disruption.
- Report through one of the private channels above before public
  disclosure.
- Give us a reasonable time to investigate and fix the issue before
  publishing.

## Hardening notes

agentlint is local-first by design:

- The CLI never phones home by default — see
  [`CHARTER.md`](./docs/CHARTER.md).
- The HTML reporter is fully self-contained: no external CSS, no
  fonts, no scripts. Reports work offline.
- The only network calls are in the optional documentation-surface
  scan (`--url`), and they go through `safeFetch` with an
  `AbortSignal.timeout`.
- No telemetry, no analytics, no opt-out flag because there's nothing
  to opt out of.
