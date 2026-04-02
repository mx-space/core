#!/usr/bin/env node

import { createHash } from 'node:crypto'
import process from 'node:process'

import mongoose from 'mongoose'

const DEFAULT_DB_NAME = 'mx-space'
const DEFAULT_REF_TYPES = ['posts', 'pages', 'notes']
const DEFAULT_LIMIT = 20

function md5(text) {
  return createHash('md5').update(text).digest('hex')
}

function parseArgs(argv) {
  const options = {
    uri: process.env.MONGO_URI || '',
    dbName: process.env.MONGO_DB || DEFAULT_DB_NAME,
    refTypes: [...DEFAULT_REF_TYPES],
    langs: null,
    visibility: 'all',
    limit: DEFAULT_LIMIT,
    json: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--uri' && next) {
      options.uri = next
      i++
      continue
    }
    if (arg === '--db' && next) {
      options.dbName = next
      i++
      continue
    }
    if (arg === '--ref-types' && next) {
      options.refTypes = next
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
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
      options.visibility = next
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
  node apps/core/scripts/check-ai-translation-hash.mjs --uri <mongo-uri> [options]

Options:
  --db <name>               Database name, default: ${DEFAULT_DB_NAME}
  --ref-types <list>        Comma-separated list, default: ${DEFAULT_REF_TYPES.join(',')}
  --langs <list|auto>       Comma-separated list, or "auto" from ai_translations
  --visibility <mode>       "all" or "visible", default: all
  --limit <n>               Preview row limit, default: ${DEFAULT_LIMIT}
  --json                    Print full JSON result
  --help, -h                Show this help

Environment:
  MONGO_URI                 Mongo connection string
  MONGO_DB                  Database name override
`)
}

function safeMetaLang(meta) {
  return meta && typeof meta === 'object' && typeof meta.lang === 'string'
    ? meta.lang
    : undefined
}

function isLexical(doc) {
  return doc?.contentFormat === 'lexical'
}

function canonicalizeLexicalContentForHash(content) {
  if (!content) return content

  try {
    const editorState = JSON.parse(content)
    return JSON.stringify(normalizeLexicalValueForHash(editorState))
  } catch {
    return content
  }
}

function normalizeLexicalValueForHash(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLexicalValueForHash(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const record = value
  const normalized = {}
  const keys = Object.keys(record).sort()

  for (const key of keys) {
    const raw = record[key]

    if (
      key === '$' &&
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw)
    ) {
      const stateNormalized = {}
      const stateKeys = Object.keys(raw).sort()

      for (const stateKey of stateKeys) {
        if (stateKey === 'blockId') continue
        stateNormalized[stateKey] = normalizeLexicalValueForHash(raw[stateKey])
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

function computeContentHash(doc, sourceLang) {
  const sourceOfTruth = isLexical(doc)
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

function isVisible(refType, doc) {
  if (refType === 'posts') {
    return doc.isPublished !== false
  }

  if (refType === 'notes') {
    if (doc.isPublished === false) return false
    if (doc.password) return false
    if (doc.publicAt) {
      const publicAt = new Date(doc.publicAt)
      if (!Number.isNaN(publicAt.getTime()) && publicAt.getTime() > Date.now()) {
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

function buildArticleProjection(refType) {
  return {
    _id: 1,
    title: 1,
    text: 1,
    subtitle: 1,
    summary: 1,
    tags: 1,
    contentFormat: 1,
    content: 1,
    meta: 1,
    modified: 1,
    created: 1,
    isPublished: 1,
    password: 1,
    publicAt: 1,
    nid: refType === 'notes' ? 1 : 0,
    slug: 1,
  }
}

function pad(value, width) {
  return String(value).padEnd(width, ' ')
}

function printPretty(report, limit) {
  console.log('Summary')
  console.log(
    [
      pad('refType', 10),
      pad('source', 8),
      pad('valid', 8),
      pad('missing', 8),
      pad('stale', 8),
    ].join(' '),
  )

  for (const refType of Object.keys(report.summary.byRefType)) {
    const item = report.summary.byRefType[refType]
    console.log(
      [
        pad(refType, 10),
        pad(item.sourceCount, 8),
        pad(item.validCount, 8),
        pad(item.missingCount, 8),
        pad(item.staleCount, 8),
      ].join(' '),
    )
  }

  console.log('')
  console.log(`Target languages: ${report.targetLanguages.join(', ')}`)
  console.log(`Task payload count: ${report.taskPayloads.length}`)

  const previewSections = [
    ['Missing preview', report.missing],
    ['Stale preview', report.stale],
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

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  if (!options.uri) {
    console.error('Missing Mongo URI. Pass --uri or set MONGO_URI.')
    process.exitCode = 1
    return
  }

  if (!['all', 'visible'].includes(options.visibility)) {
    console.error('Invalid --visibility. Expected "all" or "visible".')
    process.exitCode = 1
    return
  }

  await mongoose.connect(options.uri, {
    dbName: options.dbName,
    serverSelectionTimeoutMS: 10000,
  })

  try {
    const db = mongoose.connection.db
    const aiTranslations = db.collection('ai_translations')

    let targetLanguages = options.langs
    if (!targetLanguages || targetLanguages.includes('auto')) {
      targetLanguages = (await aiTranslations.distinct('lang')).sort()
    }

    const translationRows = await aiTranslations
      .find(
        { refType: { $in: options.refTypes }, lang: { $in: targetLanguages } },
        {
          projection: {
            _id: 0,
            hash: 1,
            refId: 1,
            refType: 1,
            lang: 1,
            sourceLang: 1,
            sourceModified: 1,
            created: 1,
          },
        },
      )
      .toArray()

    const translationMap = new Map()
    for (const row of translationRows) {
      translationMap.set(`${row.refType}::${row.refId}::${row.lang}`, row)
    }

    const report = {
      dbName: options.dbName,
      targetLanguages,
      options: {
        refTypes: options.refTypes,
        visibility: options.visibility,
      },
      summary: {
        translationRowCount: translationRows.length,
        sourceCount: 0,
        validCount: 0,
        missingCount: 0,
        staleCount: 0,
        byRefType: {},
      },
      missing: [],
      stale: [],
      taskPayloads: [],
    }

    const taskMap = new Map()

    for (const refType of options.refTypes) {
      const collection = db.collection(refType)
      const sourceDocs = await collection
        .find({}, { projection: buildArticleProjection(refType) })
        .toArray()

      const visibleDocs =
        options.visibility === 'visible'
          ? sourceDocs.filter((doc) => isVisible(refType, doc))
          : sourceDocs

      report.summary.byRefType[refType] = {
        sourceCount: visibleDocs.length,
        validCount: 0,
        missingCount: 0,
        staleCount: 0,
      }
      report.summary.sourceCount += visibleDocs.length

      for (const doc of visibleDocs) {
        const refId = String(doc._id)
        const visibility = isVisible(refType, doc)
        const taskKey = `${refType}::${refId}`

        for (const lang of targetLanguages) {
          const translation = translationMap.get(`${refType}::${refId}::${lang}`)

          if (!translation) {
            const row = {
              reason: 'missing',
              refType,
              refId,
              lang,
              title: doc.title,
              nid: doc.nid ?? null,
              slug: doc.slug ?? null,
              visible: visibility,
            }
            report.missing.push(row)
            report.summary.missingCount++
            report.summary.byRefType[refType].missingCount++

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
            taskMap.get(taskKey).targetLanguages.add(lang)
            continue
          }

          const sourceLang = safeMetaLang(doc.meta) || translation.sourceLang || 'unknown'
          const currentHash = computeContentHash(
            {
              title: doc.title,
              text: doc.text,
              subtitle: doc.subtitle,
              summary: doc.summary,
              tags: doc.tags,
              contentFormat: doc.contentFormat,
              content: doc.content,
            },
            sourceLang,
          )

          if (translation.hash !== currentHash) {
            const row = {
              reason: 'stale',
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
            report.stale.push(row)
            report.summary.staleCount++
            report.summary.byRefType[refType].staleCount++

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
            taskMap.get(taskKey).targetLanguages.add(lang)
          } else {
            report.summary.validCount++
            report.summary.byRefType[refType].validCount++
          }
        }
      }
    }

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

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printPretty(report, options.limit)
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
