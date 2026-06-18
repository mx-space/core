#!/usr/bin/env node

import process from 'node:process'

process.argv = [process.argv[0], process.argv[1]]

const SKILLS = [
  {
    name: 'db-migration-author',
    description:
      'Expand-contract Postgres migrations safe for rolling deploys with two replicas.',
    body: `## When to use

Use this skill when authoring or reviewing any Postgres migration in mx-core.
The deploy topology is two replicas behind Dokploy; a migration that breaks
either the old code or the new code mid-rollout will take the site down.

## Rules

- **Expand-contract only.** Never drop a column, rename, or tighten NOT NULL
  in a single release. Split into two PRs: expand (additive) → backfill +
  release → contract (destructive).
- **Backfill in batches.** A single \`UPDATE\` over the whole table holds
  locks the live app needs.
- **No data migrations in the SQL file.** Put any non-DDL work in a one-shot
  script under \`apps/core/src/migration/postgres-data-migration/\`.

## Commands

\`\`\`bash
pnpm -C apps/core run lint:migrations
pnpm -C apps/core run migrate
\`\`\`
`,
  },
  {
    name: 'commit-message-writer',
    description:
      'Conventional Commit messages tuned for mx-core / mx-admin monorepo scopes.',
    body: `## When to use

Use this skill to draft a commit message for staged changes in mx-core or
the apps/admin subpackage.

## Format

\`\`\`
<type>(<scope>): <subject>

<body>
\`\`\`

- **type**: \`feat\` | \`fix\` | \`chore\` | \`refactor\` | \`test\` | \`docs\` | \`perf\`
- **scope**: the touched module (\`core\`, \`admin\`, \`snippet\`, \`post\`,
  \`ai\`, \`db\`)
- **subject**: imperative, no trailing period, under 70 chars
- **body**: explain *why*, not *what*. Wrap at 72.

## Rules

- Never add \`Co-Authored-By: Claude\` or any AI-coauthor trailer.
- One logical change per commit. If you touched migrations and a controller
  in two unrelated PRs' worth of work, split.
- Reference the issue in the body, not the subject.
`,
  },
  {
    name: 'nestjs-controller-reviewer',
    description:
      'Review a NestJS controller in mx-core for envelope, casing, and error contract compliance.',
    body: `## When to use

Use this skill when reviewing a controller diff in \`apps/core/src/modules/\`.
It encodes the project's API response and error contracts so the reviewer
does not have to re-read CLAUDE.md every time.

## Checklist

1. **Envelope.** Does the handler return a bare value (auto-wrapped to
   \`{data}\`) or use \`withMeta(data, meta)\`? Returning a literal
   \`{data, ...}\` double-wraps.
2. **Error throws.** All errors via \`AppException\` subclasses or
   \`createAppException(AppErrorCode.X)\`. No raw \`HttpException\` in new
   code unless documented.
3. **Case transform.** Inputs are camelCase end-to-end. Any free-form jsonb
   field returned in the response needs
   \`@BypassCaseTransform(['<path>'])\` — paths root at \`data\`, NOT
   \`'data.<path>'\` (the transformer receives \`envelope.data\` as root).
4. **Views.** Field selection through a \`*.views.ts\` Zod schema. No
   ad-hoc \`?select=\` parsing in the controller body.
5. **Auth.** \`@Auth()\` on every mutating route. \`@CurrentUser()\` for the
   actor.

## Output format

Return findings as a JSON array of \`{file, line, severity, summary}\` where
\`severity ∈ ['critical', 'important', 'minor']\`.
`,
  },
] as const

async function main() {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { Pool } = await import('pg')
  const { eq, desc } = await import('drizzle-orm')
  const schema = await import('../src/database/schema')
  const { POSTGRES } = await import('../src/app.config')
  const { SnowflakeGenerator } = await import('@mx-space/db-schema/id')

  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    database: POSTGRES.database,
    host: POSTGRES.host,
    password: POSTGRES.password,
    port: POSTGRES.port,
    ssl: POSTGRES.ssl,
    user: POSTGRES.user,
    max: 4,
  })
  const db = drizzle(pool, { schema, casing: 'snake_case' })
  const ids = new SnowflakeGenerator({ workerId: 7 })

  try {
    console.log('[seed-skills] upserting demo skills')

    const insertedIds: string[] = []
    for (const skill of SKILLS) {
      const skillPath = `sk/${skill.name}/SKILL.md`
      const existing = await db
        .select({ id: schema.snippets.id })
        .from(schema.snippets)
        .where(eq(schema.snippets.path, skillPath))
        .limit(1)

      const raw = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}`

      if (existing.length > 0) {
        await db
          .update(schema.snippets)
          .set({
            raw,
            comment: skill.description,
            type: 'skill',
            private: false,
            path: skillPath,
            enable: true,
            updatedAt: new Date(),
          })
          .where(eq(schema.snippets.id, existing[0].id))
        insertedIds.push(existing[0].id)
        console.log(`[seed-skills] updated ${skill.name} (${existing[0].id})`)
      } else {
        const id = ids.nextId()
        await db.insert(schema.snippets).values({
          id,
          type: 'skill',
          path: skillPath,
          raw,
          comment: skill.description,
          private: false,
          enable: true,
        })
        insertedIds.push(id)
        console.log(`[seed-skills] inserted ${skill.name} (${id})`)
      }
    }

    console.log('[seed-skills] attaching skills to two latest posts')
    const recentPosts = await db
      .select({
        id: schema.posts.id,
        title: schema.posts.title,
        slug: schema.posts.slug,
        meta: schema.posts.meta,
      })
      .from(schema.posts)
      .where(eq(schema.posts.isPublished, true))
      .orderBy(desc(schema.posts.createdAt))
      .limit(2)

    if (recentPosts.length === 0) {
      console.warn('[seed-skills] no published posts found — skipping attach')
    } else {
      const [postA, postB] = recentPosts
      const nextMetaA = {
        ...postA.meta,
        skillIds: insertedIds,
      }
      await db
        .update(schema.posts)
        .set({ meta: nextMetaA })
        .where(eq(schema.posts.id, postA.id))
      console.log(
        `[seed-skills] attached ${insertedIds.length} skills to "${postA.title}" (${postA.slug})`,
      )

      if (postB) {
        const nextMetaB = {
          ...postB.meta,
          skillIds: [insertedIds[0]],
        }
        await db
          .update(schema.posts)
          .set({ meta: nextMetaB })
          .where(eq(schema.posts.id, postB.id))
        console.log(
          `[seed-skills] attached 1 skill to "${postB.title}" (${postB.slug})`,
        )
      }
    }

    console.log('[seed-skills] done')
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[seed-skills] failed:', error)
  process.exit(1)
})
