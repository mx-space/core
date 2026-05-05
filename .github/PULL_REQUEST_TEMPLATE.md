<!-- Concise summary of the change. -->

## Summary

-
-

## Test plan

- [ ]
- [ ]

## Database migrations checklist (delete if no schema change)

- [ ] Migration is backwards-compatible with the previous release's code
      (rolling deploy: new and old pods coexist during cutover).
- [ ] Drop / rename / type-change is staged across multiple releases
      (expand now, contract in a follow-up release).
- [ ] Indexes on large tables use `CREATE INDEX CONCURRENTLY` (and break
      out of drizzle's default transaction).
- [ ] `pnpm -C apps/core run lint:migrations` passes.
- [ ] If `migration-lint:allow=` is used, `reason=` explains why and a
      reviewer has agreed.
- [ ] Follow-up contract migration tracked in an issue (if applicable).

See `.claude/skills/mx-migration-author/SKILL.md` for the expand-contract
decision tree and the spec at
`docs/superpowers/specs/2026-05-05-database-migration-release-phase-design.md`.
