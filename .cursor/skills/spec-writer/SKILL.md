---
name: spec-writer
description: Writes a single feature spec in docs/specs/ from the approved plan. Use when creating or revising a specification file.
disable-model-invocation: true
---

# Spec Writer

Write one feature specification at a time for Easy Exchange, based on the approved plan in `docs/plan.md`.

## When to use

Invoke explicitly when creating or revising a single file under `docs/specs/`.

## Spec catalog

Use these exact file names:

| File | Feature |
|------|---------|
| `00-architecture.md` | Architecture |
| `01-data-model.md` | Data model |
| `02-auth-and-users.md` | Auth and users |
| `03-listings.md` | Listings |
| `04-browse.md` | Browse |
| `05-trade-offers.md` | Trade offers |
| `06-trade-completion-and-ratings.md` | Trade completion and ratings |
| `07-seed-data.md` | Seed data |

## Workflow

1. Read `docs/plan.md`. If its first line is not `Status: Approved`, stop and tell the user.
2. Write only the one spec the user names. Do not write other specs or any code.
3. If the plan is ambiguous or silent on something the spec needs, list the questions and wait for answers instead of inventing behavior.
4. Save the spec with `Status: Draft` as its first line. Never set it to Approved.

## Rules

- Trace every spec to relevant sections of `docs/plan.md`.
- Prefer plan language for statuses, rules, and MVP Must/Should/Won't.
- For the output shape, read [references/spec-template.md](references/spec-template.md) and follow it.
- After writing a draft, remind the user to add an entry to `PROCESS_LOG.md`.
- Before writing, read any existing specs in `docs/specs/` that this spec depends on (at minimum `01-data-model.md` once it exists). Use their entity and field names exactly. If something conflicts, list the conflict in Open questions instead of silently diverging.
- When revising a spec that is `Status: Approved`, set it back to `Status: Draft` and summarize what changed, so the user can re-approve it.
