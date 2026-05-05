---
name: mx-migration-author
description: |
  Author and review Drizzle SQL migrations safely for rolling deploys. Triggers when editing
  apps/core/src/database/schema/*.ts or apps/core/src/database/migrations/*.sql, when the user
  runs drizzle-kit generate, when "lint-migrations" reports a violation, or on prompts like
  "迁移", "改 schema", "alter table", "add a column", "drop column", "migration safety".
  Enforces the expand-contract pattern because mx-core ships rolling deploys (Dokploy, 2 replicas)
  where new and old pods coexist for tens of seconds during cutover.
argument-hint: [migration-file-path]
---

# MX Migration Author

Migrations run as a release-phase step (see
`docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md`).
Schema changes must be backwards-compatible with the previous release's
code, because old replicas keep serving traffic until rolling deploy
finishes.

## §A Invariants

1. mx-core ships rolling deploy. New and old pods run simultaneously
   during cutover.
2. Therefore: release `N`'s migration must work with release `N-1`'s
   code without errors. The contract-side change (drop / rename / type
   change) must wait one release after the expand-side change.
3. `mx-migrate` runs to completion before any `mx-core` pod starts. The
   app refuses to start if schema is behind. This means migration
   failures **block the deploy** rather than crash-loop replicas.
4. Drizzle migrations run inside a transaction by default. CONCURRENTLY
   index creation requires `--> statement-breakpoint` to break out.

## §B Decision tree

```
Is the change additive (table / nullable column / index / FK)?
├── yes  → use §C.1 (one release)
└── no   → expand first, contract later — see §C.2 (multiple releases)
```

## §C.1 Expand templates (single release)

| Operation | Safe approach |
|---|---|
| Add table | `CREATE TABLE` (drizzle generates) — safe; old code has no reference. |
| Add nullable column | `ADD COLUMN col TYPE` — safe. |
| Add NOT NULL column | **Three releases.** Phase 1: add nullable + dual-write in code. Phase 2: backfill (separate SQL migration). Phase 3: `ALTER COLUMN col SET NOT NULL`. |
| Add NOT NULL with DEFAULT | `ADD COLUMN col TYPE NOT NULL DEFAULT <expr>` — single release, but consider table size: a wide DEFAULT rewrites the table. |
| Add index (small table) | `CREATE INDEX` is fine. |
| Add index (large table, est. >1M rows) | `CREATE INDEX CONCURRENTLY`. Must be its own statement and **not** inside a drizzle transaction. Annotate the breakpoint and the lint allow. |
| Add FK (large table) | Two releases: `ADD CONSTRAINT ... NOT VALID`, then `VALIDATE CONSTRAINT`. |

## §C.2 Mutate / contract templates (multiple releases)

| Operation | Stages |
|---|---|
| Drop column | R1: stop reading/writing the column in code (deploy code only). R2: `ALTER TABLE ... DROP COLUMN`. |
| Rename column | R1: add new column. R2: dual-write (read old preferentially, write both). R3: backfill, switch reads to new. R4: drop old column. |
| Change column type | R1: add new column. R2: backfill + dual-write. R3: cut over readers/writers. R4: drop old. |
| Drop NOT NULL | One release — relaxing constraint is safe. |
| Add NOT NULL | See §C.1 row. |
| Drop table | R1: stop all references in code. R2: `DROP TABLE IF EXISTS`. |
| Drop index | One release — only loses performance; not a correctness break. |

## §D Working with the lint guard

`pnpm -C apps/core run lint:migrations` flags dangerous patterns
(`no-drop-column`, `no-drop-table`, `no-bare-not-null-add`,
`no-rename-column`, `no-alter-type`, `no-bare-create-index`). The lint
runs in CI on every PR.

If the lint flags a statement and the change is genuinely safe in this
context (e.g. baseline cutover with no existing consumers, large-batch
rebuild on a known-cold table), add a per-statement annotation **above
or on the same line** as the statement:

```sql
-- migration-lint:allow=no-drop-column reason=baseline cutover, no consumers yet
ALTER TABLE users DROP COLUMN email;
```

`reason=` is mandatory. Bare `migration-lint:allow=*` without `reason=`
is itself a lint error. Reviewers must read the reason; do not slip
allow annotations past review without justification.

## §E Self-checklist (run after generating each migration)

```
[ ] Is this migration backwards-compatible with the previous release's code?
[ ] Does any DDL acquire AccessExclusive on a hot table? (DROP/RENAME/TYPE)
[ ] Indexes on large tables are CONCURRENTLY (and broken out of drizzle's tx)?
[ ] If a backfill is needed, is it staged so it does not block?
[ ] Is a follow-up contract migration tracked (issue / next-release plan)?
[ ] `pnpm -C apps/core run lint:migrations` passes locally?
[ ] Migration applied cleanly against an ephemeral testcontainer?
```

## §F Authoring workflow

1. Edit `apps/core/src/database/schema/*.ts`.
2. Run `pnpm -C apps/core exec drizzle-kit generate` to scaffold the SQL.
3. Read the generated SQL. Restructure if the change implies a
   contract operation — split into expand-now / contract-later
   migrations across releases.
4. `pnpm -C apps/core run lint:migrations`. Fix or annotate.
5. Apply locally: `pnpm -C apps/core run migrate`.
6. Add tests covering the schema change (repository spec, e2e where
   user-facing). For NOT NULL adds with default, also write a test that
   reads existing rows.
7. Commit. PR title prefix: `migration:` or `db:`. PR body must include
   the expand-contract phase plan.

## §G What this skill must not do

- Decide unilaterally to add `migration-lint:allow=` — that's a human
  judgment call. Suggest the annotation and the reason, surface the
  trade-off, but require explicit user confirmation.
- Combine expand and contract into one migration, except for the
  baseline (idx ≤ 0003).
- Suggest schema changes without first reading
  `apps/core/src/database/schema/` to understand current shape.
- Use `applyMigrations` or any boot-time mutation. Migration is a
  release-phase step, end of story.

## §H Cross-references

- `release-core` skill — release pipeline, version bump, image tag.
- `mx-review` — broader review conventions.
- `api-conventions` — controller / DTO conventions, often coupled to
  schema.
- `zod-patterns` — DTO shape often follows schema; update both.
- Spec doc:
  `docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md`.
