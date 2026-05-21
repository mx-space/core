import { Injectable } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'

import { OptionsRepository } from '../configs/options.repository'
import { AnalyzeRepository } from './analyze.repository'

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000
const defaultRange = (from?: Date, to?: Date) => ({
  from: from ?? new Date(Date.now() - SEVEN_DAYS_MS),
  to: to ?? new Date(),
})

@Injectable()
export class AnalyzeService {
  constructor(
    private readonly optionsRepository: OptionsRepository,
    private readonly analyzeRepository: AnalyzeRepository,
    private readonly redisService: RedisService,
  ) {}

  async recordMany(
    records: Array<{
      ip?: string | null
      ua?: Record<string, unknown> | null
      country?: string | null
      path?: string | null
      referer?: string | null
    }>,
  ) {
    return this.analyzeRepository.recordMany(records)
  }

  async incrementApiCallTime(count: number) {
    await this.optionsRepository.increment('apiCallTime', count)
  }

  async incrementUv(count = 1) {
    await this.optionsRepository.increment('uv', count)
  }

  async getRangeAnalyzeData(
    from = new Date('2020-1-1'),
    to = new Date(),
    options?: {
      limit?: number
      page?: number
    },
  ) {
    const { limit = 50, page = 1 } = options || {}
    const result = await this.analyzeRepository.list({
      from,
      to,
      page,
      size: limit,
    })
    return {
      docs: result.data,
      totalDocs: result.pagination.total,
      page: result.pagination.currentPage,
      totalPages: result.pagination.totalPage,
      limit: result.pagination.size,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  }

  async getCallTime() {
    const callTime = (await this.optionsRepository.get('apiCallTime')) || 0
    const uv = (await this.optionsRepository.get('uv')) || 0

    return { callTime, uv }
  }
  async cleanAnalyzeRange(range: { from?: Date; to?: Date }) {
    const { from, to } = range

    await this.analyzeRepository.deleteByRange(from, to)
  }

  async getIpAndPvAggregateByRange(
    {
      from,
      to,
      granularity,
    }: {
      from: Date
      to: Date
      granularity: 'hour' | 'date'
    },
    returnObj?: boolean,
  ) {
    const keyField = granularity === 'hour' ? 'hour' : 'date'
    const result = await this.analyzeRepository.aggregateIpPvByRange(
      from,
      to,
      granularity,
    )

    const records = result.map((item) => ({
      [keyField]: item.key,
      pv: item.pv,
      ip: item.ip,
    }))

    if (returnObj) {
      return Object.fromEntries(
        result.map((item, idx) => [item.key, records[idx]]),
      ) as Record<string, Record<string, string | number>>
    }

    return records.sort((a, b) =>
      String(b[keyField] ?? '').localeCompare(String(a[keyField] ?? '')),
    )
  }

  async getRangeOfTopPathVisitor(from?: Date, to?: Date): Promise<any[]> {
    const range = defaultRange(from, to)
    return this.analyzeRepository.aggregateByPath(range.from, range.to, 50)
  }

  async getTodayAccessIp(): Promise<string[]> {
    const redis = this.redisService.getClient()
    return redis.smembers(getRedisKey(RedisKeys.AccessIp))
  }

  async getDeviceDistribution(from?: Date, to?: Date) {
    const range = defaultRange(from, to)
    const data = await this.analyzeRepository.aggregateDeviceDistribution(
      range.from,
      range.to,
    )

    const deviceTypeMap: Record<string, string> = {
      desktop: 'Desktop',
      mobile: 'Mobile',
      tablet: 'Tablet',
      unknown: 'Unknown',
    }

    return {
      browsers: data.browsers,
      os: data.os,
      devices: data.devices.map((item) => ({
        name: deviceTypeMap[item.name?.toLowerCase()] || item.name || 'Desktop',
        value: item.value,
      })),
    }
  }

  /**
   * UA-based aggregate-stat traffic source kept distinct from
   * referer-based `getTrafficSource`: dashboard `TrafficSource.tsx`
   * reads `{os, browser}` from `/aggregate/stat/traffic-source` —
   * referers go to `/analyze/traffic-source` which has a different shape.
   */
  async getUaTrafficDistribution(from?: Date, to?: Date) {
    const range = defaultRange(from, to)
    const dist = await this.analyzeRepository.aggregateDeviceDistribution(
      range.from,
      range.to,
    )
    const toCount = (item: { name: string; value: number }) => ({
      name: item.name,
      count: item.value,
    })
    return {
      os: dist.os.map(toCount),
      browser: dist.browsers.map(toCount),
    }
  }

  async getTrafficSource(from?: Date, to?: Date) {
    const range = defaultRange(from, to)
    const result = await this.analyzeRepository.aggregateReferers(
      range.from,
      range.to,
    )

    const categories = { direct: 0, search: 0, social: 0, other: 0 }
    const detailsMap = new Map<string, number>()

    for (const item of result) {
      const referer = item.referer.toLowerCase()
      const count = item.count

      if (!referer) {
        categories.direct += count
        continue
      }

      let hostname: string
      try {
        hostname = new URL(referer).hostname.toLowerCase()
      } catch {
        categories.other += count
        continue
      }

      const bucket = classifyReferer(hostname)
      categories[bucket] += count
      detailsMap.set(hostname, (detailsMap.get(hostname) ?? 0) + count)
    }

    return {
      categories: [
        { name: 'Direct', value: categories.direct },
        { name: 'Search engine', value: categories.search },
        { name: 'Social media', value: categories.social },
        { name: 'Other', value: categories.other },
      ].filter((c) => c.value > 0),
      details: [...detailsMap.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    }
  }
}

const SEARCH_ENGINE_HOSTS = [
  'google',
  'bing',
  'baidu',
  'sogou',
  'so.com',
  '360.cn',
  'yahoo',
  'duckduckgo',
  'yandex',
]

const SOCIAL_NETWORK_HOSTS = [
  'twitter',
  'x.com',
  'facebook',
  'weibo',
  'zhihu',
  'douban',
  'reddit',
  'linkedin',
  'instagram',
  'tiktok',
  'youtube',
  'bilibili',
  't.me',
  'telegram',
  'discord',
]

function classifyReferer(hostname: string): 'search' | 'social' | 'other' {
  if (SEARCH_ENGINE_HOSTS.some((engine) => hostname.includes(engine))) {
    return 'search'
  }
  if (SOCIAL_NETWORK_HOSTS.some((network) => hostname.includes(network))) {
    return 'social'
  }
  return 'other'
}
