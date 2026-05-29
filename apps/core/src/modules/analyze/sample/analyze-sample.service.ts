import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'

import {
  getRng,
  pickOne,
  pickWeighted,
  rangeInt,
  shuffle,
} from '~/shared/sample/prng'
import type { SampleResponseContext } from '~/shared/sample/sample-response.interceptor'

const PATHS: ReadonlyArray<readonly [string, number]> = [
  ['/posts/hello-world', 6],
  ['/posts/typescript-tips', 5],
  ['/posts/vue-best-practices', 4],
  ['/posts/react-hooks-deep-dive', 4],
  ['/posts/system-design-101', 3],
  ['/notes/1', 5],
  ['/notes/2', 4],
  ['/notes/3', 3],
  ['/notes/4', 2],
  ['/pages/about', 2],
  ['/pages/links', 2],
  ['/', 8],
  ['/feed', 1],
  ['/sitemap.xml', 1],
]

const BROWSERS = [
  { name: 'Chrome', version: '120.0.6099.109', major: '120' },
  { name: 'Safari', version: '17.2', major: '17' },
  { name: 'Firefox', version: '121.0', major: '121' },
  { name: 'Edge', version: '120.0.2210.91', major: '120' },
  { name: 'Opera', version: '105.0.4970.34', major: '105' },
] as const

const OS_LIST = [
  { name: 'macOS', version: '14.2' },
  { name: 'Windows', version: '11' },
  { name: 'Windows', version: '10' },
  { name: 'iOS', version: '17.2' },
  { name: 'Android', version: '14' },
  { name: 'Linux', version: '' },
] as const

const COUNTRIES = ['CN', 'US', 'JP', 'GB', 'DE', 'SG', 'HK', 'TW', 'KR', null]

const REFERERS: ReadonlyArray<readonly [string, number]> = [
  ['', 18],
  ['https://www.google.com/search?q=blog', 8],
  ['https://www.google.com/search?q=typescript', 5],
  ['https://www.bing.com/search?q=react', 3],
  ['https://www.baidu.com/s?wd=nestjs', 3],
  ['https://x.com/innei_xyz/status/1700', 4],
  ['https://twitter.com/example/status/100', 3],
  ['https://weibo.com/example/12345', 2],
  ['https://t.me/devchannel/789', 2],
  ['https://www.zhihu.com/question/1234', 3],
  ['https://github.com/mx-space/mx-core', 4],
  ['https://reddit.com/r/typescript', 1],
  ['https://news.ycombinator.com/item?id=1', 1],
]

const TRAFFIC_CATEGORY_TARGETS: ReadonlyArray<{
  name: string
  share: number
}> = [
  { name: 'Direct', share: 0.34 },
  { name: 'Search engine', share: 0.31 },
  { name: 'Social media', share: 0.23 },
  { name: 'Other', share: 0.12 },
]

const TRAFFIC_DETAIL_SOURCES = [
  'google.com',
  'bing.com',
  'baidu.com',
  'x.com',
  'twitter.com',
  'weibo.com',
  't.me',
  'zhihu.com',
  'github.com',
  'reddit.com',
  'news.ycombinator.com',
  'duckduckgo.com',
] as const

function randomIp(rng: () => number): string {
  return `${rangeInt(1, 254, rng)}.${rangeInt(0, 255, rng)}.${rangeInt(0, 255, rng)}.${rangeInt(1, 254, rng)}`
}

function buildHourlySeries(target: number, rng: () => number) {
  const slots = Array.from({ length: 24 }, () => Math.max(0.1, rng()))
  const sum = slots.reduce((acc, v) => acc + v, 0)
  return slots.map((v) => Math.max(1, Math.round((v / sum) * target)))
}

function buildDailySeries(days: number, target: number, rng: () => number) {
  const slots = Array.from({ length: days }, () => Math.max(0.2, rng()))
  const sum = slots.reduce((acc, v) => acc + v, 0)
  return slots.map((v) => Math.max(2, Math.round((v / sum) * target)))
}

@Injectable()
export class AnalyzeSampleService {
  aggregate() {
    const rng = getRng('analyze:aggregate')

    const totalPv = rangeInt(28000, 36000, rng)
    const totalUv = Math.round(totalPv / rangeInt(3, 5, rng))

    const dayPv = buildHourlySeries(rangeInt(900, 1400, rng), rng)
    const dayIp = dayPv.map((pv) =>
      Math.max(1, Math.round(pv / rangeInt(2, 5, rng))),
    )

    const today = Array.from({ length: 24 }, (_, i) => {
      const hour = `${i}:00`
      return [
        { hour, key: 'ip' as const, value: dayIp[i]! },
        { hour, key: 'pv' as const, value: dayPv[i]! },
      ]
    }).flat()

    const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekPv = buildDailySeries(7, rangeInt(7000, 9500, rng), rng)
    const weekIp = weekPv.map((pv) => Math.round(pv / rangeInt(3, 5, rng)))
    const now = dayjs()
    const weeks = Array.from({ length: 7 }, (_, i) => {
      const day = weekDayLabels[now.subtract(6 - i, 'day').day()]!
      return [
        { day, key: 'ip' as const, value: weekIp[i]! },
        { day, key: 'pv' as const, value: weekPv[i]! },
      ]
    }).flat()

    const monthPv = buildDailySeries(30, rangeInt(26000, 34000, rng), rng)
    const monthIp = monthPv.map((pv) => Math.round(pv / rangeInt(3, 5, rng)))
    const months = Array.from({ length: 30 }, (_, i) => {
      const ts = now.subtract(29 - i, 'day')
      const date = `${(ts.month() + 1).toString().padStart(2, '0')}-${ts
        .date()
        .toString()
        .padStart(2, '0')}`
      return [
        { date, key: 'ip' as const, value: monthIp[i]! },
        { date, key: 'pv' as const, value: monthPv[i]! },
      ]
    }).flat()

    const pathCounts = new Map<string, number>()
    for (let i = 0; i < 600; i += 1) {
      const path = pickWeighted(PATHS, rng)
      pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1)
    }
    const paths = [...pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([path, count]) => ({ path, count }))

    const todayIpCount = rangeInt(22, 38, rng)
    const todayIps = Array.from({ length: todayIpCount }, () => randomIp(rng))

    return {
      today,
      weeks,
      months,
      paths,
      total: { callTime: totalPv, uv: totalUv },
      todayIps,
    }
  }

  list(ctx: SampleResponseContext) {
    const rng = getRng('analyze:list')
    const sizeRaw = Number(ctx.query['size'] ?? 50)
    const pageRaw = Number(ctx.query['page'] ?? 1)
    const size =
      Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.trunc(sizeRaw) : 50
    const page =
      Number.isFinite(pageRaw) && pageRaw > 0 ? Math.trunc(pageRaw) : 1

    const total = 500
    const totalPages = Math.max(1, Math.ceil(total / size))
    const safePage = Math.min(page, totalPages)
    const startIndex = (safePage - 1) * size
    const endIndex = Math.min(startIndex + size, total)

    const now = Date.now()
    const windowMs = 30 * 24 * 3600 * 1000

    const data = Array.from({ length: endIndex - startIndex }, (_, idx) => {
      const browser = pickOne(BROWSERS, rng)
      const osItem = pickOne(OS_LIST, rng)
      const offset = Math.floor(rng() * windowMs)
      return {
        id: `sample-analyze-${startIndex + idx}`,
        ip: randomIp(rng),
        country: pickOne(COUNTRIES, rng),
        path: pickWeighted(PATHS, rng),
        referer: pickWeighted(REFERERS, rng) || null,
        timestamp: new Date(now - offset).toISOString(),
        ua: {
          ua: `${browser.name}/${browser.version} (${osItem.name} ${osItem.version})`,
          browser,
          os: osItem,
          engine: { name: 'Blink', version: browser.version },
        },
      }
    })

    return {
      data,
      pagination: {
        page: safePage,
        size,
        total,
        totalPages,
        currentPage: safePage,
        totalPage: totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    }
  }

  device() {
    const rng = getRng('analyze:device')

    const deviceWeights: Array<readonly [string, number]> = [
      ['Desktop', 0.62],
      ['Mobile', 0.32],
      ['Tablet', 0.06],
    ]

    const total = rangeInt(4500, 6800, rng)
    const devices = deviceWeights.map(([name, share]) => ({
      name,
      value: Math.max(1, Math.round(total * share * (0.9 + rng() * 0.2))),
    }))

    const browsers = shuffle(BROWSERS, rng).map((b, idx) => ({
      name: b.name,
      value: Math.max(
        1,
        Math.round(total * (0.42 - idx * 0.08) * (0.9 + rng() * 0.2)),
      ),
    }))

    const os = shuffle(OS_LIST, rng).map((o, idx) => ({
      name: o.name,
      value: Math.max(
        1,
        Math.round(total * (0.38 - idx * 0.06) * (0.9 + rng() * 0.2)),
      ),
    }))

    return { devices, browsers, os }
  }

  trafficSource() {
    const rng = getRng('analyze:traffic-source')
    const totalEvents = rangeInt(8500, 12500, rng)

    const categories = TRAFFIC_CATEGORY_TARGETS.map(({ name, share }) => ({
      name,
      value: Math.max(1, Math.round(totalEvents * share * (0.9 + rng() * 0.2))),
    }))

    const remaining = Math.max(
      1,
      categories.reduce((acc, c) => acc + c.value, 0) - categories[0]!.value,
    )

    const details = shuffle(TRAFFIC_DETAIL_SOURCES, rng)
      .slice(0, rangeInt(8, 12, rng))
      .map((source, idx) => ({
        source,
        count: Math.max(
          1,
          Math.round((remaining / (idx + 1.4)) * (0.6 + rng() * 0.8)),
        ),
      }))
      .sort((a, b) => b.count - a.count)

    return { categories, details }
  }
}
