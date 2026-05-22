// Smoke-diff harness: compare every Yohaku-used endpoint between
//   :2333  → V2 envelope, normalized by createLegacyApiClient
//   :3333  → V1-style envelope, returned as-is
// Reports endpoints whose normalized payloads diverge.
//
// Run:  node packages/api-client/scripts/smoke-diff.mjs [endpointGrep]

import {
  allControllers,
  createClient,
} from '../dist/index.mjs'
import { fetchAdaptor } from '../dist/adaptors/fetch.mjs'
import { createLegacyApiClient } from '../dist/legacy/index.mjs'

const NEW_PORT = process.env.NEW_PORT ?? '2333'
const OLD_PORT = process.env.OLD_PORT ?? '3333'
const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null

const newClient = createLegacyApiClient(fetchAdaptor)(`http://127.0.0.1:${NEW_PORT}`, {
  controllers: allControllers,
})

// 3333 may run a build that already wraps responses in { data, meta }.
// Use the same legacy adapter to normalize both ends; differences then
// reflect server-side data divergence rather than envelope shape.
const oldClient = createLegacyApiClient(fetchAdaptor)(`http://127.0.0.1:${OLD_PORT}`, {
  controllers: allControllers,
})

const cases = [
  ['aggregate.getAggregateData("shiro")', (c) => c.aggregate.getAggregateData('shiro')],
  ['aggregate.getTop(5)', (c) => c.aggregate.getTop(5)],
  ['aggregate.getTimeline()', (c) => c.aggregate.getTimeline?.()],
  ['aggregate.getStat()', (c) => c.aggregate.getStat?.()],
  ['post.getList(1,3)', (c) => c.post.getList(1, 3)],
  ['post.getLatest()', (c) => c.post.getLatest?.()],
  ['note.getList(1,3)', (c) => c.note.getList(1, 3)],
  ['note.getLatest()', (c) => c.note.getLatest()],
  ['page.getList(1,50)', (c) => c.page.getList(1, 50)],
  ['category.getAllCategories()', (c) => c.category.getAllCategories()],
  ['category.getAllTags()', (c) => c.category.getAllTags()],
  ['recently.getList({size:5})', (c) => c.recently.getList({ size: 5 })],
  ['say.getAllPaginated(1,5)', (c) => c.say.getAllPaginated(1, 5)],
  ['link.getAll()', (c) => c.link.getAll()],
  ['link.canApplyLink()', (c) => c.link.canApplyLink()],
  ['project.getAll()', (c) => c.project.getAll()],
  ['topic.getAll()', (c) => c.topic.getAll()],
  ['activity.getLastYearPublication()', (c) => c.activity.getLastYearPublication()],
  ['activity.getRecentActivities()', (c) => c.activity.getRecentActivities()],
  ['activity.getRoomsInfo()', (c) => c.activity.getRoomsInfo()],
  ['search.searchAll("ai")', (c) => c.search.searchAll('ai', { type: 'POST' })],
  ['comment.getUploadConfig()', (c) => c.comment.getUploadConfig()],

  // Sampled (depend on existence of seed content)
  ['post.getPost (sampled)', async (c) => {
    const list = await c.post.getList(1, 1)
    const item = (list?.data ?? list)?.[0]
    if (!item) return null
    return c.post.getPost(item.category?.slug ?? item.category, item.slug)
  }],
  ['note.getNoteByNid (sampled)', async (c) => {
    const latest = await c.note.getLatest()
    const nid = latest?.data?.nid ?? latest?.nid
    if (!nid) return null
    return c.note.getNoteByNid(+nid)
  }],
  ['page.getBySlug (sampled)', async (c) => {
    const list = await c.page.getList(1, 1)
    const item = (list?.data ?? list)?.[0]
    if (!item) return null
    return c.page.getBySlug(item.slug)
  }],
  ['category.getCategoryByIdOrSlug (sampled)', async (c) => {
    const cats = await c.category.getAllCategories()
    const slug = (cats?.data ?? cats)?.[0]?.slug
    if (!slug) return null
    return c.category.getCategoryByIdOrSlug(slug)
  }],
  ['topic.getTopicBySlug (sampled)', async (c) => {
    const list = await c.topic.getAll()
    const slug = (list?.data ?? list)?.[0]?.slug
    if (!slug) return null
    return c.topic.getTopicBySlug(slug)
  }],
  ['comment.getByRefId (sampled)', async (c) => {
    const list = await c.post.getList(1, 1)
    const item = (list?.data ?? list)?.[0]
    if (!item) return null
    return c.comment.getByRefId(item.id, {})
  }],
  ['recently.getById (sampled)', async (c) => {
    const list = await c.recently.getList({ size: 1 })
    const id = (list?.data ?? list)?.[0]?.id
    if (!id) return null
    return c.recently.getById(id)
  }],
  ['recently.getLatestOne()', (c) => c.recently.getLatestOne?.()],
  ['recently.getAll()', (c) => c.recently.getAll?.()],
  ['note.getMiddleList (sampled)', async (c) => {
    const list = await c.note.getList(1, 1)
    const id = (list?.data ?? list)?.[0]?.id
    if (!id) return null
    return c.note.getMiddleList?.(id, 5)
  }],
  ['note.getNoteBySlugDate (sampled)', async (c) => {
    const list = await c.note.getList(1, 1)
    const item = (list?.data ?? list)?.[0]
    if (!item?.slug) return null
    const d = new Date(item.created_at ?? item.createdAt ?? Date.now())
    return c.note.getNoteBySlugDate(item.slug, d.getFullYear(), d.getMonth() + 1, d.getDate())
  }],
  ['note.getTopicRecentUpdate (sampled)', async (c) => {
    const topics = await c.topic.getAll()
    const id = (topics?.data ?? topics)?.[0]?.id
    if (!id) return null
    return c.note.getTopicRecentUpdate(id)
  }],
  ['note.getNoteByTopicId (sampled)', async (c) => {
    const topics = await c.topic.getAll()
    const id = (topics?.data ?? topics)?.[0]?.id
    if (!id) return null
    return c.note.getNoteByTopicId?.(id)
  }],
  ['category.getTagByName (sampled)', async (c) => {
    const tags = await c.category.getAllTags()
    const name = (tags?.data ?? tags)?.[0]?.name
    if (!name) return null
    return c.category.getTagByName(name)
  }],
  ['comment.getThreadReplies (sampled)', async (c) => {
    const posts = await c.post.getList(1, 1)
    const refId = (posts?.data ?? posts)?.[0]?.id
    if (!refId) return null
    const list = await c.comment.getByRefId(refId, {})
    const cmtId = (list?.data ?? list)?.[0]?.id
    if (!cmtId) return null
    return c.comment.getThreadReplies(cmtId, {})
  }],
  ['comment.getById (sampled)', async (c) => {
    const posts = await c.post.getList(1, 1)
    const refId = (posts?.data ?? posts)?.[0]?.id
    if (!refId) return null
    const list = await c.comment.getByRefId(refId, {})
    const id = (list?.data ?? list)?.[0]?.id
    if (!id) return null
    return c.comment.getById(id)
  }],
  ['ai.getSummary (sampled)', async (c) => {
    const list = await c.post.getList(1, 1)
    const id = (list?.data ?? list)?.[0]?.id
    if (!id) return null
    return c.ai.getSummary?.({ refId: id, type: 'POST' })
  }],
  ['ai.getInsights (sampled)', async (c) => {
    const list = await c.post.getList(1, 1)
    const id = (list?.data ?? list)?.[0]?.id
    if (!id) return null
    return c.ai.getInsights?.({ refId: id, type: 'POST' })
  }],
  ['activity.getPresence (sampled)', (c) => c.activity.getPresence('home')],
  ['subscribe.check', (c) => c.subscribe.check?.()],
  ['aggregate.getLatest()', (c) => c.aggregate.getLatest?.({})],
  ['aggregate.getSiteMetadata()', (c) => c.aggregate.getSiteMetadata?.()],
  ['page.getById (sampled)', async (c) => {
    const list = await c.page.getList(1, 1)
    const id = (list?.data ?? list)?.[0]?.id
    if (!id) return null
    return c.page.getById(id)
  }],
  // --- Proxy GET endpoints (data diff) ---
  ['aggregate.proxy.site_info.get', (c) => c.aggregate.proxy.site_info.get()],
  ['proxy.fn.shiro.status.get', (c) => c.proxy.fn.shiro.status.get()],
  ['proxy("like_this").get', (c) => c.proxy('like_this').get()],
  ['proxy.auth.providers.get', (c) =>
    c.proxy.auth.providers.get({ params: { type: 'social' } }),
  ],

  // --- Write-class & dynamic-proxy endpoints (status-only contract check) ---
  // For these we only check that V1 and V2 agree on HTTP status (endpoint exists / same auth gate).
  ['WRITE: activity.likeIt (sampled)', async (c) => {
    const list = await c.post.getList(1, 1)
    const id = (list?.data ?? list)?.[0]?.id
    if (!id) throw new Error('no post')
    return c.activity.likeIt('Post', id)
  }, 'status'],
  ['WRITE: activity.updatePresence', (c) =>
    c.activity.updatePresence({ roomName: 'home', position: 0, ts: Date.now() }),
    'status',
  ],
  ['WRITE: ack.read (sampled)', async (c) => {
    const list = await c.post.getList(1, 1)
    const id = (list?.data ?? list)?.[0]?.id
    if (!id) throw new Error('no post')
    return c.ack.read('post', id)
  }, 'status'],
  ['WRITE: owner.logout', (c) => c.owner.logout(), 'status'],
  ['WRITE: subscribe.subscribe', (c) =>
    c.subscribe.subscribe?.({ email: 'smoke@example.com', types: 0 }),
    'status',
  ],
  ['WRITE: comment.uploadImage (skipped)', () => Promise.resolve(null), 'status'],

  // Dynamic proxy paths used by Yohaku
  ['PROXY GET: /serverless/shiro/status (admin)', (c) =>
    c.serverless.proxy.shiro.status.get(),
    'status',
  ],
  ['PROXY GET: /auth/session', (c) => c.proxy.auth.session.get(), 'status'],
  ['PROXY GET: /note/proxy/list (sampled)', async (c) => {
    const latest = await c.note.getLatest()
    const id = latest?.data?.id ?? latest?.id
    if (!id) return null
    return c.note.proxy.list(id).get()
  }],
]

// Random / non-deterministic endpoints: skip (different ends pick different rows).
const NON_DETERMINISTIC = new Set(['say.getRandom()'])

const VOLATILE_KEY = /(read_count|like|comments_index|view|count|last_login_time|updated_at|modified_at|presence|online|ts|timestamp|nonce)/i

function normalize(v) {
  if (Array.isArray(v)) return v.map(normalize)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) out[k] = normalize(v[k])
    return out
  }
  return v
}

function diff(a, b, p = '') {
  if (a === b) return []
  if (VOLATILE_KEY.test(p)) return []
  if (typeof a !== typeof b) return [{ p, k: 'typeMismatch', a: typeof a, b: typeof b }]
  if (a == null || b == null) return [{ p, k: 'nullDiff', a, b }]
  if (Array.isArray(a) !== Array.isArray(b)) return [{ p, k: 'arrayMismatch' }]
  if (Array.isArray(a)) {
    const out = []
    if (a.length !== b.length) out.push({ p, k: 'arrLen', a: a.length, b: b.length })
    for (let i = 0; i < Math.min(a.length, b.length, 3); i++) out.push(...diff(a[i], b[i], `${p}[${i}]`))
    return out
  }
  if (typeof a === 'object') {
    const ka = new Set(Object.keys(a))
    const kb = new Set(Object.keys(b))
    const out = []
    for (const k of ka) if (!kb.has(k)) out.push({ p: `${p}.${k}`, k: 'onlyInNew' })
    for (const k of kb) if (!ka.has(k)) out.push({ p: `${p}.${k}`, k: 'onlyInOld' })
    for (const k of ka) if (kb.has(k)) out.push(...diff(a[k], b[k], `${p}.${k}`))
    return out
  }
  return [{ p, k: 'value', a, b }]
}

const SUMMARY = { ok: 0, diff: 0, err: 0, skip: 0 }
const DIFFS = []

async function runCaseValue(fn, client) {
  try {
    return { ok: true, value: await fn(client) }
  } catch (e) {
    return { ok: false, status: e?.status ?? null, message: e?.message ?? String(e) }
  }
}

for (const [name, fn, mode] of cases) {
  if (filter && !filter.test(name)) continue
  if (NON_DETERMINISTIC.has(name)) {
    console.log(`SKIP ${name} (non-deterministic)`)
    SUMMARY.skip++
    continue
  }

  if (mode === 'status') {
    // Compare only HTTP status (endpoint contract / auth gate).
    const [a, b] = await Promise.all([
      runCaseValue(fn, newClient),
      runCaseValue(fn, oldClient),
    ])
    const sa = a.ok ? 200 : a.status
    const sb = b.ok ? 200 : b.status
    if (sa === sb) {
      console.log(`OK   ${name}  (status=${sa})`)
      SUMMARY.ok++
    } else {
      console.log(`DIFF ${name}  V2 status=${sa} V1 status=${sb}`)
      console.log(`     V2: ${a.ok ? 'ok' : a.message?.slice(0, 100)}`)
      console.log(`     V1: ${b.ok ? 'ok' : b.message?.slice(0, 100)}`)
      SUMMARY.diff++
      DIFFS.push({ name, mode: 'status', v2: sa, v1: sb })
    }
    continue
  }

  try {
    const [na, ob] = await Promise.all([fn(newClient), fn(oldClient)])
    if (na == null && ob == null) {
      console.log(`SKIP ${name} (no seed data)`)
      SUMMARY.skip++
      continue
    }
    const d = diff(normalize(na), normalize(ob))
    if (d.length === 0) {
      console.log(`OK   ${name}`)
      SUMMARY.ok++
    } else {
      console.log(`DIFF ${name}  (${d.length} differences)`)
      d.slice(0, 10).forEach((x) => console.log('     ', JSON.stringify(x).slice(0, 240)))
      SUMMARY.diff++
      DIFFS.push({ name, diffs: d })
    }
  } catch (e) {
    console.log(`ERR  ${name}: ${(e?.message ?? e)?.toString().slice(0, 220)}`)
    SUMMARY.err++
  }
}

console.log('\n=== SUMMARY ===')
console.log(SUMMARY)
if (DIFFS.length) {
  const reportPath = new URL('./smoke-diff-report.json', import.meta.url)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(reportPath, JSON.stringify(DIFFS, null, 2))
  console.log(`Full report written: ${reportPath.pathname}`)
}
