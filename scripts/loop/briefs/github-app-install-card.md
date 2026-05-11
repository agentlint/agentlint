# Brief — github-app-install-card

## One-line goal

Dashboard card on the project page that detects whether the GitHub App is
installed for the project's owner and shows an Install CTA when not.
Carry-over from slice 7 — currently the App is installed via
https://github.com/apps/agentlint-ci directly with no in-product nudge.

## Repo

`agentlint/agentlint.sh` (web repo) — `~/Code/agentlint-sh`.

## Definition of done

A reviewer can verify:

1. On `/dashboard/orgs/[slug]/projects/[projectId]`, a new "GitHub App"
   card renders one of three states:
   - **Installed (green)**: "agentlint-ci is installed on <owner>. Scans
     run automatically on push." with a "Manage on GitHub" link.
   - **Not installed (amber)**: "Install agentlint-ci on <owner> to enable
     automatic scans on push." with an "Install on GitHub" CTA pointing
     at the App's install URL with `state=<orgSlug>` set (so the
     post-install bounce lands back on this project).
   - **Suspended (red)**: "agentlint-ci is suspended on <owner>. Reinstall
     to re-enable scans." with a re-install CTA.
2. The check reads the `installation` table joined to the project's
   `repoOwner`. No GitHub API call on render (purely DB-driven).
3. 6+ tests covering all three states, plus 401/403 access control.

## In scope

- New `components/github-app-install-card.tsx` (server component).
- New helper `lib/github-app/install-state.ts` returning
  `{ state: "installed" | "not_installed" | "suspended", installation?: …,
  installUrl: string }`.
- Project page imports the card.
- Tests in `*.test.ts` next to source.

## Out of scope

- A redesign of the rest of the project page.
- Hitting the GitHub API on render — that's a future ops upgrade if the
  cached `installation.repos` jsonb gets stale enough to matter.
- Multi-installation handling for users who installed the App on multiple
  orgs — current scope is per-project owner.

## Charter check

- No CLI change.
- No scoring change.

## Open decisions you may resolve

- Should the card link to a docs page explaining what permissions the
  App requests? **RESOLVED:** yes, but tonight it links to a stub
  `/docs/github-app` that just lists the four permissions
  (PRs R/W, Contents R, Checks R/W, Metadata R) inline. A full docs page
  is a future docs slice.

## Notes for the agent

- `GITHUB_APP_SLUG` env var (set on every Vercel target) drives the
  install URL: `https://github.com/apps/${slug}/installations/new?state=${orgSlug}`.
- The post-install bounce route (`/api/github/post-install`) already
  handles the `state=<slug>` → 302 back to the project page (ADR-0022).
