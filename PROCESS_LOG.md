# Easy Exchange: AI-Assisted Development Process Log

## How to read this log
Each entry records one significant step: the prompt or skill used,
what the AI produced, and what I accepted, changed, or rejected and why.

---

## Entry 01: Project setup
- **Date:** Oct 6, 2026
- **Phase:** Setup
- **Tool / Skill used:** None (manual)
- **What I did:** Created the `easy-exchange` GitHub repo, opened it in Cursor,
  and set up `docs/specs/`, `.cursor/skills/`, `.cursor/rules/`, and this log.
- **Why:** Planning, specs, and skills each get a dedicated home before any
  code exists, so the process is traceable from the first commit.

---

## Entry 02: Wrong shell in AI-provided commands
- **Date:** Oct 6, 2026
- **Phase:** Setup
- **Tool / Skill used:** Terminal (PowerShell)
- **What happened:** The setup commands I was given were bash (`mkdir -p`,
  `touch`), but my environment is Windows PowerShell, so both failed.
- **What I changed:** Switched to PowerShell equivalents
  (`New-Item -ItemType Directory -Force`, `New-Item -ItemType File`).
- **Lesson learned:** AI output assumes an environment unless told otherwise.
  This is why my project rule now states "PowerShell only".

---

## Entry 03: Created the project workflow rule
- **Date:** Oct 6, 2026
- **Phase:** Setup
- **Tool / Skill used:** `/create-rule` (Cursor built-in skill)
- **Prompt (verbatim):**
```
  Create a project rule that always applies to every request in this repo.

  Context: This is "easy-exchange", a goods-exchange web app built for a
  course on AI-assisted software engineering. The process matters more
  than the product, so the rule should enforce a disciplined workflow.

  The rule must state:
  1. Environment: Windows with PowerShell. Any terminal commands must be
     PowerShell, never bash.
  2. Workflow order: planning → specs → implementation. Do not write
     application code unless a relevant, approved spec exists in docs/specs/.
     If asked to code without one, stop and say which spec is missing.
  3. Ambiguity: when requirements are unclear, ask clarifying questions
     before acting instead of making assumptions.
  4. Scope: implement only what the referenced spec describes. Suggest
     extra ideas separately; do not build them.
  5. Change size: prefer small, focused changes and summarize what changed
     and why at the end of each response.
  6. Traceability: after any significant step, remind me to add an entry
     to PROCESS_LOG.md.

  Do not mention a tech stack yet; that will be decided during planning.
  Keep the rule concise.
```
- **What the AI produced:** `.cursor/rules/easy-exchange-workflow.mdc` with
  `alwaysApply: true`, covering all six points.
- **Evidence it works:** In the same response, the agent ended with a
  "What changed and why" summary and a PROCESS_LOG reminder (rules 5 and 6).
- **Why no tech stack:** Choosing a stack before planning would mean deciding
  architecture before requirements.

---

## Entry 04: Reviewed and fixed the workflow rule
- **Date:** Oct 6, 2026
- **Phase:** Setup
- **Tool / Skill used:** Manual edit
- **What I did:** Reviewed the AI-generated rule. "Approved spec" was undefined,
  so the agent could treat its own drafts as approved. Added a Status line
  (Draft/Approved) that only I can change.
- **Why manual:** Small, exact change; I wrote the approval policy myself so the
  AI doesn't define its own permissions.

---

## Entry 05: Planning session in Plan Mode
- **Date:** Oct 6, 2026
- **Phase:** Planning
- **Tool / Skill used:** Cursor Agent in Plan Mode
- **Prompt (verbatim):**
```
  You are a senior product engineer helping me plan a web app. Do NOT write
  any application code in this session.

  Context: "Easy Exchange" is a platform where collectors trade collectibles
  with each other (item-for-item swaps, no money changes hands). It's built
  by one developer for a course on AI-assisted software engineering, where
  the development process matters more than the final product.

  Step 1: Before proposing anything, ask me up to 7 clarifying questions
  about the most important unknowns (for example: which collectible
  categories to support, how condition is described, how trades are agreed
  and completed, and trust between strangers). Ask them all at once, then
  wait for my answers.

  Step 2: After I answer, produce a plan with these sections:
  - Problem statement and target users
  - MVP features, prioritized as Must / Should / Won't (for this MVP)
  - Core user flows, step by step (list an item, browse, propose a trade,
    respond to an offer, complete a trade)
  - Key domain concepts and rules (especially the lifecycle of a trade offer)
  - Tech stack options: 2 options with trade-offs, plus a recommendation
  - Risks and open questions

  Constraints: MVP must be buildable in about one week by one developer.
  No payments, no real-time chat, no mobile app.

  Output: Markdown, to be saved as docs/plan.md, starting with the line
  "Status: Draft".
```
- **What the AI did first:** Asked 7 clarifying questions instead of
  guessing: categories, condition, listing shape, trade agreement,
  completion, trust & identity, and audience.
- **My answers (the human decisions):**
  1. Categories: fixed list (Trading Cards, Coins, Action Figures, Comics),
     extensible in the data model.
  2. Condition: fixed scale (Mint, Near Mint, Excellent, Good, Fair) plus
     optional notes.
  3. Listing: title, category, condition, description, 1–3 photos required;
     optional estimated value (fairness hint only) and "looking for" text.
     Full wishlist is a Should.
  4. Trade: proposer offers 1–3 items for 1 item; receiver accepts/declines;
     proposer can cancel while pending; no counter-offers. On accept, involved
     items become unavailable and conflicting pending offers auto-cancel.
  5. Completion: arranged offline; both parties mark "received"; complete
     when both confirm. No tracking.
  6. Trust: email/password, display name, optional city; 1–5 rating after
     completion. No report/block or extra verification.
  7. Audience: casual collectors; public sign-up plus seeded demo accounts.
- **What the AI produced:** A full plan with Must/Should/Won't, a user-flow
  diagram, a domain rules table, a trade-offer state diagram (Pending →
  Accepted / Declined / Cancelled → Completed), two stack options with a
  recommendation (Next.js), risks, and its own open questions.
- **Lesson learned:** Forcing clarifying questions first meant the plan
  reflected my decisions, not the AI's assumptions. It even flagged its
  own open questions instead of silently deciding them.

---

## Entry 06: Reviewed and revised the plan before saving
- **Date:** Oct 6, 2026
- **Phase:** Planning
- **Tool / Skill used:** Cursor Agent (Plan Mode), manual review, manual approval
- **Gaps I found in the AI's draft:**
  1. Accepted trades could get stuck forever. No exit from Accepted if one
     party never confirms. This was an accidental gap, not a decision.
  2. The listing status "Available / Unavailable (or equivalent)" was vague
     and blurred "locked in a trade" with "already traded."
  3. Implied rules weren't stated: no offers on your own listing; no editing
     or deleting a listing involved in a pending offer or active trade.
  4. Open questions left undecided that I could resolve now.
- **Prompt (verbatim):**
```
  Revise the plan with these decisions before writing it:

  1. Listing statuses: Available, InTrade (part of an accepted trade),
     Traded (trade completed). Replace "Available / Unavailable".
  2. Add rules: users cannot propose a trade on their own listing; a
     listing that is in any Pending offer or in an Accepted trade cannot be
     edited or deleted.
  3. Add to Won't: cancelling or disputing a trade after it is Accepted.
     Add to Risks: an accepted trade can stall if one party never confirms.
  4. Resolve the open questions:
     - Photos: local filesystem storage, JPEG/PNG only, max 5 MB each.
     - Declined and cancelled offers stay visible in each user's offer history.
     - A proposer may have only one Pending offer per target listing.
     - Traded listings are kept with status Traded (never hard-deleted).
     - Password reset: Won't for MVP; demo accounts are sufficient.
  5. Tech stack: I choose Option A (Next.js + TypeScript + Prisma + SQLite +
     Auth.js), for a single codebase and shared types in a one-week build.

  Keep everything else as is. Show me only the changed sections.
```
- **Why "show only the changed sections":** It made the AI's revisions
  quick to verify instead of rereading the whole plan.
- **Approval:** After confirming the revisions in `docs/plan.md`, I changed
  `Status: Draft` to `Status: Approved` by hand, as my project rule requires.
- **Lesson learned:** The AI's plan was good but not complete. Human review
  caught a state-machine dead end and vague statuses that would have become
  bugs during implementation.

---

## Entry 07: Created the spec-writer skill
- **Date:** Oct 6, 2026
- **Phase:** Skills
- **Tool / Skill used:** `/create-skill` (Cursor built-in skill)
- **Prompt (verbatim):**
```
  Create a project-level skill named "spec-writer" in .cursor/skills/spec-writer/.

  Purpose: write one feature specification at a time for this repo, based on
  the approved plan in docs/plan.md.

  Frontmatter:
  - name: spec-writer
  - description: Writes a single feature spec in docs/specs/ from the approved
    plan. Use when creating or revising a specification file.
  - disable-model-invocation: true (I want to invoke it explicitly)

  Structure:
  - Keep SKILL.md short: when to use it, the workflow, and the rules.
  - Put the full spec template in references/spec-template.md so it loads
    only when needed.

  Workflow the skill must follow:
  1. Read docs/plan.md. If its first line is not "Status: Approved", stop
     and tell me.
  2. Write only the one spec I name. Do not write other specs or any code.
  3. If the plan is ambiguous or silent on something the spec needs, list
     the questions and wait for my answers instead of inventing behavior.
  4. Save the spec with "Status: Draft" as its first line. Never set it to
     Approved.

  The template must include these sections:
  - Status line, title, and a "Traces to" line naming the plan sections it
    implements
  - Purpose (2–3 sentences)
  - In scope / Out of scope
  - Business rules (numbered, so they can be referenced as R1, R2, ...)
  - Data involved (entities and fields this feature touches)
  - User flows or API behavior
  - Acceptance criteria in Given / When / Then format, each tagged with
    the rule(s) it verifies
  - Edge cases and error handling
  - Open questions

  Include this spec catalog in SKILL.md so file names stay consistent:
  00-architecture.md, 01-data-model.md, 02-auth-and-users.md,
  03-listings.md, 04-browse.md, 05-trade-offers.md,
  06-trade-completion-and-ratings.md, 07-seed-data.md
```
- **What the AI produced:** `.cursor/skills/spec-writer/SKILL.md` (workflow,
  rules, spec catalog) and `references/spec-template.md` (full template).
- **Verification:** Confirmed `spec-writer` appears under Customize → Skills
  and in the `/` menu in Agent chat.
- **What I changed or rejected, and why:** Output matched the prompt. I added
  two rules by hand: (1) read dependent specs and use their names exactly, so
  specs stay consistent with each other; (2) revising an approved spec resets
  it to Draft, so no approved spec can change without my sign-off.
  Also edited the template: (3) spec-prefixed IDs (e.g. 05-R1) so rules are
  unique across specs; (4) every rule must have at least one acceptance
  criterion; (5) architecture and data-model specs may mark sections N/A
  instead of inventing content.
- **Design decisions:**
  - **Specs organized by feature, not document type.** Each spec maps to one
    implementation slice, so the implementing agent gets everything it needs
    from a single file.
  - **`disable-model-invocation: true`.** Specs are only written when I
    deliberately invoke the skill, never automatically.
  - **Template in `references/`.** Skills load resources progressively, so the
    long template only enters context when the skill runs.
  - **Plan-approval check.** The skill refuses to run unless `docs/plan.md` is
    approved, which chains it to my project rule.
  - **Rule numbers on acceptance criteria.** Creates traceability from
    plan → business rule (R1, R2…) → acceptance test.
- **Lesson learned:** A skill turns a good prompt into a reusable standard.
  Every spec will follow the same structure regardless of how I phrase the
  request.

---

## Entry 08: Architecture spec (first use of spec-writer)
- **Date:** Oct 6, 2026
- **Phase:** Specs
- **Tool / Skill used:** `/spec-writer` (custom skill)
- **What happened:** The skill checked that docs/plan.md was Approved, then
  asked 7 architecture questions instead of guessing (mutations, src/ layout,
  validation, unit tests, integration tests, photo storage, Auth.js version).
- **My answers:** Server Actions; src/ layout; Zod; Vitest; Vitest + separate
  SQLite test DB, no browser E2E; gitignored uploads/ via Route Handler;
  Auth.js v5 Credentials + JWT, pinned, bcrypt.
- **What the AI produced:** 13 architectural rules (00-R1–R13), each verified
  by an inspectable acceptance criterion.
- **Review:** Approved without changes. Open questions deferred to the specs
  that own them.

---

## Entry 09: Data model spec
- **Date:** Oct 6, 2026
- **Phase:** Specs
- **Tool / Skill used:** `/spec-writer`
- **What happened:** The skill asked 8 schema questions (completed state, received
  flags, offered items, categories, IDs, cancel provenance, value storage, rating
  uniqueness). I answered all 8.
- **Review fixes (manual):** Added `@default(Pending)` on offer status; required
  `receiverId` to be set server-side from the target listing owner; added an open
  question about Prisma enum support on SQLite.

---

## Entry 10: Specs 02–07 written by parallel agents
- **Date:** Oct 6, 2026
- **Phase:** Specs
- **Tool / Skill used:** `/spec-writer` in 6 parallel agent tabs
- **What happened:** Ran one agent per spec at the same time, each in a fresh
  context. Answered each agent's clarifying questions from the plan
  (02: profile edits, password rules, session payload; 04: own listings,
  guest access, catalog contents, detail and photo visibility).
- **Why parallel:** Each spec mainly depends on the plan, 00, and 01, so they
  could be drafted independently, saving significant time.
- **Cross-spec conflicts:** Because specs were written in parallel, 03 and 04
  disagreed on photo visibility, and 04 assumed a "My listings" page 03 never
  defined. The agents flagged these as open questions instead of guessing
  (my cross-spec consistency rule in spec-writer).
- **Review of 05:** Found 3 rules without acceptance criteria (05-R1, R7, R17),
  breaking the template's coverage rule. Added 05-AC14–16 by hand.
- **Tradeoff learned:** Parallel agents are faster but need a reconciliation
  pass. Specs that look independent still share assumptions.

---

## Entry 11: Implementation skill + imported skill
- **Date:** Oct 6, 2026
- **Phase:** Skills
- **Tool / Skill used:** Manual creation; imported `frontend-design` from
  Anthropic's public skills repo (github.com/anthropics/skills), with its LICENSE
- **What I did:** Wrote `implement-from-spec` (approval check, tests first,
  spec-only scope, self-logging). Imported `frontend-design` and read it before
  enabling, since a third-party skill is instructions my agent will follow.
- **Review findings:** The skill asks the agent to confirm the product subject
  with the client before designing. My specs already define it, so I give
  design direction in the implementation prompt. It auto-invokes on UI work
  (no `disable-model-invocation`), which suits design guidance. My own skills
  are manual-only because they control workflow.
---


## Entry 12: Slice 1 scaffold, schema, and seed
- **Date:** Oct 6, 2026
- **Phase:** Implementation
- **Tool / Skill used:** `/implement-from-spec`
- **Prompt (verbatim):**
  /implement-from-spec Slice 1: project scaffold per 00-architecture.md,
  Prisma schema per 01-data-model.md, and seed data per 07-seed-data.md.
  Scaffold Next.js in the current repo root (do not create a subfolder).
  Create a .env with DATABASE_URL and AUTH_SECRET, and make sure .env is
  gitignored. Add npm scripts for dev, test, db:seed, and typecheck.
- **What the AI produced (summary):** Next.js app in the repo root; Prisma 7
  schema and init migration; `prisma/seed.ts` with the demo catalog and JPEG
  fixtures copied into `uploads/`; Auth.js v5 Credentials + JWT pinned at
  `next-auth@5.0.0-beta.32`; `.env` gitignored. `npm test` 22 passed.
  `npm run typecheck` passed. `npm run db:seed` passed, including a second
  run that removed an extra listing and an extra uploads folder.
- **What I changed or rejected, and why:**
- **Lesson learned:**

---

## Entry template (copy for each new step)
- **Date:**
- **Phase:** Planning / Specs / Skills / Implementation / Review
- **Tool / Skill used:**
- **Prompt (verbatim):**
- **What the AI produced (summary):**
- **What I changed or rejected, and why:**
- **Lesson learned:**