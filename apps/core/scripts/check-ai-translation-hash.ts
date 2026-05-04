#!/usr/bin/env node

/**
 * Check AI translation hash freshness against source content.
 *
 * Compares stored translation hashes with freshly computed hashes from
 * posts / notes / pages to detect stale translations.
 *
 * Usage:
 *   tsx scripts/check-ai-translation-hash.ts [options]
 *   tsx scripts/check-ai-translation-hash.ts --ref-types posts,notes --langs en,ja --visibility visible
 *   tsx scripts/check-ai-translation-hash.ts --json
 */

import { createHash } from 'node:crypto'
import process from 'node:process'

// ─── Parse CLI options BEFORE resetting argv ────────────────────────

const DEFAULT_REF_TYPES = ['posts', 'pages', 'notes']
const DEFAULT_LIMIT = 20

function md5(text: string) {
  return createHash('md5').update(text).digest('hex')
}

type RefTypeTable = 'posts' | 'pages' | 'notes'

function isValidRefType(value: string): value is RefTypeTable {
  return value === 'posts' || value === 'pages' || value === 'notes'
}

interface CliOptions {
  refTypes: RefTypeTable[]
  langs: string[] | null
  visibility: 'all' | 'visible'
  limit: number
  json: boolean
  help: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    refTypes: [...DEFAULT_REF_TYPES] as RefTypeTable[],
    langs: null,
    visibility: 'all',
    limit: DEFAULT_LIMIT,
    json: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const next = argv[i + 1]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--ref-types' && next) {
      options.refTypes = next
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean) as RefTypeTable[]
      i++
      continue
    }
    if (arg === '--langs' && next) {
      options.langs = next
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      i++
      continue
    }
    if (arg === '--visibility' && next) {
      options.visibility = next as 'all' | 'visible'
      i++
      continue
    }
    if (arg === '--limit' && next) {
      options.limit = Number(next)
      i++
      continue
    }
  }

  return options
}

function printHelp() {
  console.log(`Usage:
  tsx scripts/check-ai-translation-hash.ts [options]

Options:
  --ref-types <list>        Comma-separated list, default: ${DEFAULT_REF_TYPES.join(',')}
  --langs <list|auto>       Comma-separated list, or "auto" from ai_translations
  --visibility <mode>       "all" or "visible", default: all
  --limit <n>               Preview row limit, default: ${DEFAULT_LIMIT}
  --json                    Print full JSON result
  --help, -h                Show this help

Environment:
  PG_URL / PG_CONNECTION_STRING   PostgreSQL connection string
  PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, PG_SSL
`)
}

// ─── Hash / freshness helpers ───────────────────────────────────────

function safeMetaLang(meta: Record<string, unknown> | null | undefined) {
  return meta && typeof meta === 'object' && typeof meta.lang === 'string'
    ? meta.lang
    : undefined
}

function canonicalizeLexicalContentForHash(content: string | null | undefined) {
  if (!content) return content

  try {
    const editorState = JSON.parse(content)
    return JSON.stringify(normalizeLexicalValueForHash(editorState))
  } catch {
    return content
  }
}

function normalizeLexicalValueForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLexicalValueForHash(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  const keys = Object.keys(record).sort()

  for (const key of keys) {
    const raw = record[key]

    if (key === '$' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const stateNormalized: Record<string, unknown> = {}
      const stateKeys = Object.keys(raw as Record<string, unknown>).sort()

      for (const stateKey of stateKeys) {
        if (stateKey === 'blockId') continue
        stateNormalized[stateKey] = normalizeLexicalValueForHash(
          (raw as Record<string, unknown>)[stateKey],
        )
      }

      if (Object.keys(stateNormalized).length > 0) {
        normalized[key] = stateNormalized
      }
      continue
    }

    normalized[key] = normalizeLexicalValueForHash(raw)
  }

  return normalized
}

interface DocFields {
  title: string | null
  text: string | null
  subtitle: string | null
  summary: string | null
  tags: string[] | null
  contentFormat: string | null
  content: string | null
}

interface SourceDoc extends DocFields {
  meta: Record<string, unknown> | null
  modified: Date | null
  created: Date | null
  isPublished: boolean | null
  password: string | null
  publicAt: Date | null
  nid: number | null
  slug: string | null
}

function computeContentHash(doc: DocFields, sourceLang: string) {
  const sourceOfTruth =
    doc.contentFormat === 'lexical'
      ? canonicalizeLexicalContentForHash(doc.content)
      : doc.text

  return md5(
    JSON.stringify({
      title: doc.title,
      subtitle: doc.subtitle,
      content: sourceOfTruth,
      summary: doc.summary,
      tags: doc.tags,
      sourceLang,
    }),
  )
}

function hasComparableSource(doc: {
  text: string | null
  content: string | null
}) {
  return typeof doc?.text === 'string' || typeof doc?.content === 'string'
}

function evaluateTranslationFreshness(
  doc: SourceDoc,
  translation: {
    sourceModifiedAt: Date | null
    createdAt: Date | null
    hash: string
  },
  sourceLang: string,
) {
  const articleTimestamp = doc.modified ?? doc.created ?? null

  if (
    translation.sourceModifiedAt &&
    articleTimestamp &&
    translation.sourceModifiedAt >= articleTimestamp
  ) {
    return 'valid_by_timestamp'
  }

  if (
    !translation.sourceModifiedAt &&
    articleTimestamp &&
    translation.createdAt &&
    translation.createdAt >= articleTimestamp
  ) {
    return 'valid_by_created'
  }

  if (!hasComparableSource(doc)) {
    return 'unknown'
  }

  const currentHash = computeContentHash(doc, sourceLang)

  return translation.hash === currentHash ? 'valid_by_hash' : 'runtime_stale'
}

function isVisible(refType: string, doc: SourceDoc) {
  if (refType === 'posts') {
    return doc.isPublished !== false
  }

  if (refType === 'notes') {
    if (doc.isPublished === false) return false
    if (doc.password) return false
    if (doc.publicAt) {
      const publicAt = new Date(doc.publicAt)
      if (
        !Number.isNaN(publicAt.getTime()) &&
        publicAt.getTime() > Date.now()
      ) {
        return false
      }
    }
    return true
  }

  if (refType === 'pages') {
    return true
  }

  return false
}

// ─── Pretty printer ─────────────────────────────────────────────────

interface RefTypeSummary {
  sourceCount: number
  runtimeValidCount: number
  missingCount: number
  runtimeStaleCount: number
  strictHashMismatchCount: number
}

interface Report {
  targetLanguages: string[]
  options: { refTypes: string[]; visibility: string }
  summary: {
    translationRowCount: number
    sourceCount: number
    runtimeValidCount: number
    missingCount: number
    runtimeStaleCount: number
    strictHashMismatchCount: number
    validByTimestampCount: number
    validByCreatedCount: number
    validByHashCount: number
    unknownCount: number
    byRefType: Record<string, RefTypeSummary>
  }
  missing: unknown[]
  runtimeStale: unknown[]
  strictHashMismatch: unknown[]
  taskPayloads: unknown[]
}

function pad(value: unknown, width: number) {
  return String(value).padEnd(width, ' ')
}

function printPretty(report: Report, limit: number) {
  console.log('Summary')
  console.log(
    [
      pad('refType', 10),
      pad('source', 8),
      pad('runtime', 8),
      pad('missing', 8),
      pad('stale', 8),
      pad('strict', 8),
    ].join(' '),
  )

  for (const refType of Object.keys(report.summary.byRefType)) {
    const item = report.summary.byRefType[refType]!
    console.log(
      [
        pad(refType, 10),
        pad(item.sourceCount, 8),
        pad(item.runtimeValidCount, 8),
        pad(item.missingCount, 8),
        pad(item.runtimeStaleCount, 8),
        pad(item.strictHashMismatchCount, 8),
      ].join(' '),
    )
  }

  console.log('')
  console.log(`Target languages: ${report.targetLanguages.join(', ')}`)
  console.log(
    `Runtime validity: timestamp=${report.summary.validByTimestampCount} created=${report.summary.validByCreatedCount} hash=${report.summary.validByHashCount} unknown=${report.summary.unknownCount}`,
  )
  console.log(`Task payload count: ${report.taskPayloads.length}`)

  const previewSections: [string, unknown[]][] = [
    ['Missing preview', report.missing],
    ['Runtime stale preview', report.runtimeStale],
    ['Strict hash mismatch preview', report.strictHashMismatch],
    ['Task payload preview', report.taskPayloads],
  ]

  for (const [title, rows] of previewSections) {
    console.log('')
    console.log(title)
    if (!rows.length) {
      console.log('  (none)')
      continue
    }
    for (const row of rows.slice(0, limit)) {
      console.log(`  ${JSON.stringify(row)}`)
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const rawArgv = process.argv.slice(2)
  const options = parseArgs(rawArgv)

  if (options.help) {
    printHelp()
    return
  }

  if (!['all', 'visible'].includes(options.visibility)) {
    console.error('Invalid --visibility. Expected "all" or "visible".')
    process.exitCode = 1
    return
  }

  for (const rt of options.refTypes) {
    if (!isValidRefType(rt)) {
      console.error(`Invalid ref-type "${rt}". Valid: posts, pages, notes`)
      process.exitCode = 1
      return
    }
  }

  // Reset argv so app.config's commander doesn't parse our flags.
  process.argv = [process.argv[0]!, process.argv[1]!]

  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { Pool } = await import('pg')
  const { aiTranslations, posts, notes, pages } =
    await import('../src/database/schema')
  const { POSTGRES } = await import('../src/app.config')

  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    host: POSTGRES.host,
    port: POSTGRES.port,
    user: POSTGRES.user,
    password: POSTGRES.password,
    database: POSTGRES.database,
    ssl: POSTGRES.ssl,
  })

  const db = drizzle(pool, { casing: 'snake_case' })

  try {
    const tableMap: Record<RefTypeTable, typeof posts> = {
      posts,
      notes,
      pages,
    }

    // 1. Resolve target languages
    let targetLanguages = options.langs
    if (!targetLanguages || targetLanguages.includes('auto')) {
      const distinctLangs = await db
        .selectDistinct({ lang: aiTranslations.lang })
        .from(aiTranslations)
      targetLanguages = distinctLangs.map((r) => r.lang).sort()
    }

    // 2. Load all translations (filter in-memory for simplicity)
    const allTranslationRows = await db
      .select({
        hash: aiTranslations.hash,
        refId: aiTranslations.refId,
        refType: aiTranslations.refType,
        lang: aiTranslations.lang,
        sourceLang: aiTranslations.sourceLang,
        sourceModifiedAt: aiTranslations.sourceModifiedAt,
        createdAt: aiTranslations.createdAt,
      })
      .from(aiTranslations)

    const translationMap = new Map<
      string,
      (typeof allTranslationRows)[number]
    >()
    for (const row of allTranslationRows) {
      if (
        !options.refTypes.includes(row.refType) ||
        !targetLanguages.includes(row.lang)
      ) {
        continue
      }
      translationMap.set(`${row.refType}::${row.refId}::${row.lang}`, row)
    }

    // 3. Initialize report
    const report: Report = {
      targetLanguages,
      options: {
        refTypes: options.refTypes,
        visibility: options.visibility,
      },
      summary: {
        translationRowCount: translationMap.size,
        sourceCount: 0,
        runtimeValidCount: 0,
        missingCount: 0,
        runtimeStaleCount: 0,
        strictHashMismatchCount: 0,
        validByTimestampCount: 0,
        validByCreatedCount: 0,
        validByHashCount: 0,
        unknownCount: 0,
        byRefType: {},
      },
      missing: [],
      runtimeStale: [],
      strictHashMismatch: [],
      taskPayloads: [],
    }

    const taskMap = new Map<
      string,
      {
        refType: string
        refId: string
        title: string | null
        nid: number | null
        slug: string | null
        visible: boolean
        targetLanguages: Set<string>
      }
    >()

    // 4. Process each ref type
    for (const refType of options.refTypes) {
      const table = tableMap[refType]

      // Build a select that includes type-specific columns
      const sourceRows = await db
        .select({
          id: table.id,
          title: table.title,
          text: table.text,
          content: table.content,
          contentFormat: table.contentFormat,
          summary: table.summary,
          meta: table.meta,
          tags: table.tags,
          modifiedAt: table.modifiedAt,
          createdAt: table.createdAt,
          slug: table.slug,
          ...(refType === 'posts'
            ? { isPublished: (table as typeof posts).isPublished }
            : {}),
          ...(refType === 'notes'
            ? {
                isPublished: (table as typeof notes).isPublished,
                password: (table as typeof notes).password,
                publicAt: (table as typeof notes).publicAt,
                nid: (table as typeof notes).nid,
              }
            : {}),
          ...(refType === 'pages'
            ? { subtitle: (table as typeof pages).subtitle }
            : {}),
        })
        .from(table)

      const toDoc = (row: (typeof sourceRows)[number]): SourceDoc => ({
        title: row.title ?? null,
        text: row.text ?? null,
        subtitle: 'subtitle' in row ? (row.subtitle as string | null) : null,
        summary: row.summary ?? null,
        tags: row.tags ?? null,
        contentFormat: row.contentFormat ?? null,
        content: row.content ?? null,
        meta: row.meta ?? null,
        modified: row.modifiedAt ?? null,
        created: row.createdAt ?? null,
        isPublished:
          'isPublished' in row ? (row.isPublished as boolean | null) : null,
        password: 'password' in row ? (row.password as string | null) : null,
        publicAt: 'publicAt' in row ? (row.publicAt as Date | null) : null,
        nid: 'nid' in row ? (row.nid as number | null) : null,
        slug: row.slug ?? null,
      })

      const filteredRows =
        options.visibility === 'visible'
          ? sourceRows.filter((row) => isVisible(refType, toDoc(row)))
          : sourceRows

      report.summary.byRefType[refType] = {
        sourceCount: filteredRows.length,
        runtimeValidCount: 0,
        missingCount: 0,
        runtimeStaleCount: 0,
        strictHashMismatchCount: 0,
      }
      report.summary.sourceCount += filteredRows.length

      for (const row of filteredRows) {
        const doc = toDoc(row)
        const refId = row.id
        const visibility = isVisible(refType, doc)
        const taskKey = `${refType}::${refId}`

        for (const lang of targetLanguages) {
          const translation = translationMap.get(
            `${refType}::${refId}::${lang}`,
          )

          if (!translation) {
            const entry = {
              reason: 'missing' as const,
              refType,
              refId,
              lang,
              title: doc.title,
              nid: doc.nid ?? null,
              slug: doc.slug ?? null,
              visible: visibility,
            }
            report.missing.push(entry)
            report.summary.missingCount++
            report.summary.byRefType[refType]!.missingCount++

            if (!taskMap.has(taskKey)) {
              taskMap.set(taskKey, {
                refType,
                refId,
                title: doc.title,
                nid: doc.nid ?? null,
                slug: doc.slug ?? null,
                visible: visibility,
                targetLanguages: new Set(),
              })
            }
            taskMap.get(taskKey)!.targetLanguages.add(lang)
            continue
          }

          const sourceLang =
            safeMetaLang(doc.meta) || translation.sourceLang || 'unknown'
          const currentHash = computeContentHash(doc, sourceLang)

          if (translation.hash !== currentHash) {
            const entry = {
              reason: 'strict_hash_mismatch' as const,
              refType,
              refId,
              lang,
              title: doc.title,
              nid: doc.nid ?? null,
              slug: doc.slug ?? null,
              visible: visibility,
              sourceLang,
              storedHash: translation.hash,
              currentHash,
            }
            report.strictHashMismatch.push(entry)
            report.summary.strictHashMismatchCount++
            report.summary.byRefType[refType]!.strictHashMismatchCount++
          }

          const freshness = evaluateTranslationFreshness(
            doc,
            translation,
            sourceLang,
          )

          if (freshness === 'runtime_stale') {
            const entry = {
              reason: 'runtime_stale' as const,
              refType,
              refId,
              lang,
              title: doc.title,
              nid: doc.nid ?? null,
              slug: doc.slug ?? null,
              visible: visibility,
              sourceLang,
              storedHash: translation.hash,
              currentHash,
              sourceModified: translation.sourceModifiedAt ?? null,
              created: translation.createdAt ?? null,
              articleModified: doc.modified ?? null,
              articleCreated: doc.created ?? null,
            }
            report.runtimeStale.push(entry)
            report.summary.runtimeStaleCount++
            report.summary.byRefType[refType]!.runtimeStaleCount++

            if (!taskMap.has(taskKey)) {
              taskMap.set(taskKey, {
                refType,
                refId,
                title: doc.title,
                nid: doc.nid ?? null,
                slug: doc.slug ?? null,
                visible: visibility,
                targetLanguages: new Set(),
              })
            }
            taskMap.get(taskKey)!.targetLanguages.add(lang)
          } else {
            if (freshness === 'valid_by_timestamp') {
              report.summary.runtimeValidCount++
              report.summary.byRefType[refType]!.runtimeValidCount++
              report.summary.validByTimestampCount++
            } else if (freshness === 'valid_by_created') {
              report.summary.runtimeValidCount++
              report.summary.byRefType[refType]!.runtimeValidCount++
              report.summary.validByCreatedCount++
            } else if (freshness === 'valid_by_hash') {
              report.summary.runtimeValidCount++
              report.summary.byRefType[refType]!.runtimeValidCount++
              report.summary.validByHashCount++
            } else if (freshness === 'unknown') {
              report.summary.unknownCount++
            }
          }
        }
      }
    }

    // 5. Collect task payloads
    report.taskPayloads = [...taskMap.values()]
      .map((item) => ({
        refType: item.refType,
        refId: item.refId,
        title: item.title,
        nid: item.nid,
        slug: item.slug,
        visible: item.visible,
        targetLanguages: [...item.targetLanguages].sort(),
      }))
      .sort((a, b) => {
        if (a.refType !== b.refType) return a.refType.localeCompare(b.refType)
        return a.refId.localeCompare(b.refId)
      })

    // 6. Output
    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printPretty(report, options.limit)
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
