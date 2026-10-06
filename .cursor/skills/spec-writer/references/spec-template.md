# Spec template

Use this structure for every spec under `docs/specs/`. First line must be the status.

Rules for using this template:
- Prefix rule and criterion IDs with the spec number so they are unique across
  the project (in `05-trade-offers.md`: 05-R1, 05-R2, 05-AC1, 05-AC2).
- Every business rule must be verified by at least one acceptance criterion.
- For `00-architecture.md` and `01-data-model.md`, sections that do not apply
  may say "N/A" with a one-line reason. Do not invent user flows to fill them.

```markdown
Status: Draft

# [Feature title]

Traces to: [plan section names from docs/plan.md]

## Purpose

[2–3 sentences on what this feature does and why it exists.]

## In scope

- ...

## Out of scope

- ...

## Business rules

1. NN-R1: ...
2. NN-R2: ...
3. NN-R3: ...

## Data involved

| Entity | Fields / notes |
|--------|----------------|
| ... | ... |

## User flows or API behavior

### [Flow or endpoint name]

1. ...
2. ...

## Acceptance criteria

### NN-AC1: [short name]

- **Given** ...
- **When** ...
- **Then** ...
- **Verifies:** NN-R1, NN-R2

### NN-AC2: [short name]

- **Given** ...
- **When** ...
- **Then** ...
- **Verifies:** NN-R3

## Edge cases and error handling

- ...

## Open questions

- [ ] ...
```