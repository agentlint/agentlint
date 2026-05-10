# CLAUDE.md — entry point for agents working on this repo

> If you are an agent (Claude Code, or any other) starting a session on this
> repository, this is the file to read first. It tells you, in order, where to
> get the rest of the context you need.

## Reading order (do not skip)

Read these in order before touching code. Each one is short. Together they are
the project's operating model.

1. **[`docs/CHARTER.md`](./docs/CHARTER.md)** — the constitution. Origin of the
   project, roles, autonomy boundaries (what you decide alone, what you
   confirm, what you escalate), decision-making principles, definition of
   done, co-authorship convention. The charter wins over every other document
   if anything conflicts.

2. **[`docs/PROJECT_STATE.md`](./docs/PROJECT_STATE.md)** — the live snapshot.
   Latest commit, CI status, self-audit score, what is shipped, what is in
   flight, the prioritized pending list, next milestones. This is rewritten
   at the close of every session, so it is your most up-to-date picture of
   reality.

3. **[`AGENTS.md`](./AGENTS.md)** — technical conventions. Build commands,
   architecture, naming, gotchas. The "how the code works" briefing.

4. **[`docs/PLAYBOOK.md`](./docs/PLAYBOOK.md)** — operational runbooks. How to
   cut a release, publish a blog post, triage issues, market a launch, add a
   new rule, handle security disclosures, bump a major version.

5. **[`docs/DECISIONS.md`](./docs/DECISIONS.md)** — append-only decision log
   (ADR-lite). Why pricing is what it is, why the score formula is
   renormalized, why pnpm and Biome and Vitest, why the project is
   positioned as agent-built. Don't relitigate decisions logged here without
   appending a new entry that supersedes the old one.

@AGENTS.md

## Operating principles (the short version)

The CHARTER is authoritative; this is the TL;DR.

- **Bias to action.** When the call is reversible and the cost of being wrong
  is low, decide and ship. Don't ask permission for routine work.
- **Score-of-100 invariant.** This repo must self-audit at 100/100 on every
  push to `main`. Either fix the regression in the same change or revert.
- **Public scoring API is sacred.** Rule weights and `CATEGORY_MAX` are part
  of the public contract. Changing them is a breaking change.
- **Local-first, no telemetry.** The CLI never phones home by default. Any
  network call in the hot path is a charter violation.
- **Rules never throw.** They catch and return a `fail` Result.
- **Conventional Commits, always.** `feat`, `fix`, `refactor`, `docs`,
  `test`, `chore`, `perf`, `ci`.
- **Disagree and commit.** If you think a human-stated direction is wrong,
  say so, propose an alternative, then ship the chosen path without
  sandbagging it.

## Closing-session ritual

Every session ends with this. See
[`PLAYBOOK.md` § Closing a session](./docs/PLAYBOOK.md#closing-a-session) for
the full version.

```bash
pnpm run ci             # must pass
pnpm run agentlint .    # must report 100/100
```

Then:

1. Update `docs/PROJECT_STATE.md` snapshot, done, in flight, pending.
2. Append to `docs/DECISIONS.md` if any non-obvious decisions were made.
3. Commit and push.
4. Send the human a 3-bullet summary: **shipped / pending / next**.

## Co-authorship

Commits in this repo are co-authored by Claude via
`.husky/prepare-commit-msg`. The trailer

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

is appended automatically to any commit that doesn't already include it. This
is intentional — see [`CHARTER.md` § 6](./docs/CHARTER.md#6-co-authorship-convention)
and [`DECISIONS.md` ADR-0009](./docs/DECISIONS.md#adr-0009--husky-prepare-commit-msg-hook-auto-appends-co-authored-by-claude).
