import { Injectable } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'

import { OptionsRepository } from '../configs/options.repository'
import { AnalyzeRepository } from './analyze.repository'

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

    const records = new Map<
      string,
      { [key: string]: string | number | undefined }
    >()

    for (const item of result) {
      records.set(item.key, { [keyField]: item.key, pv: item.pv, ip: item.ip })
    }

    if (returnObj) {
      const obj: Record<string, { [key: string]: string | number }> = {}
      for (const [key, value] of records) {
        obj[key] = value as { [key: string]: string | number }
      }
      return obj
    }

    return Array.from(records.values()).sort((a, b) => {
      const left = String(a[keyField] ?? '')
      const right = String(b[keyField] ?? '')
      return right.localeCompare(left)
    })
  }

  async getRangeOfTopPathVisitor(from?: Date, to?: Date): Promise<any[]> {
    from = from ?? new Date(Date.now() - 1000 * 24 * 3600 * 7)
    to = to ?? new Date()

    return this.analyzeRepository.aggregateByPath(from, to, 50)
  }

  async getTodayAccessIp(): Promise<string[]> {
    const redis = this.redisService.getClient()
    return redis.smembers(getRedisKey(RedisKeys.AccessIp))
  }

  async getDeviceDistribution(from?: Date, to?: Date) {
    from = from ?? new Date(Date.now() - 1000 * 24 * 3600 * 7)
    to = to ?? new Date()

    const data = await this.analyzeRepository.aggregateDeviceDistribution(
      from,
      to,
    )

    const deviceTypeMap: Record<string, string> = {
      desktop: '桌面端',
      mobile: '移动端',
      tablet: '平板',
      unknown: '未知',
    }

    return {
      browsers: data.browsers,
      os: data.os,
      devices: data.devices.map((item) => ({
        name: deviceTypeMap[item.name?.toLowerCase()] || item.name || '桌面端',
        value: item.value,
      })),
    }
  }

  async getTrafficSource(from?: Date, to?: Date) {
    from = from ?? new Date(Date.now() - 1000 * 24 * 3600 * 7)
    to = to ?? new Date()

    const result = await this.analyzeRepository.aggregateReferers(from, to)

    const categories: Record<string, number> = {
      direct: 0,
      search: 0,
      social: 0,
      other: 0,
    }

    const searchEngines = [
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
    const socialNetworks = [
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

    const details: Array<{ source: string; count: number }> = []

    for (const item of result) {
      const referer = item.referer.toLowerCase()
      const count = item.count

      if (!referer || referer === '') {
        categories.direct += count
        continue
      }

      let hostname = ''
      try {
        hostname = new URL(referer).hostname.toLowerCase()
      } catch {
        categories.other += count
        continue
      }

      const isSearch = searchEngines.some((engine) => hostname.includes(engine))
      const isSocial = socialNetworks.some((network) =>
        hostname.includes(network),
      )

      if (isSearch) {
        categories.search += count
      } else if (isSocial) {
        categories.social += count
      } else {
        categories.other += count
      }

      const existing = details.find((d) => d.source === hostname)
      if (existing) {
        existing.count += count
      } else {
        details.push({ source: hostname, count })
      }
    }

    return {
      categories: [
        { name: '直接访问', value: categories.direct },
        { name: '搜索引擎', value: categories.search },
        { name: '社交媒体', value: categories.social },
        { name: '其他来源', value: categories.other },
      ].filter((c) => c.value > 0),
      details: details.sort((a, b) => b.count - a.count).slice(0, 10),
    }
  }
}
