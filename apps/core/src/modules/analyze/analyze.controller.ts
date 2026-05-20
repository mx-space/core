import { Delete, Get, HttpCode, Query } from '@nestjs/common'
import dayjs from 'dayjs'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { RedisService } from '~/processors/redis/redis.service'
import type { PagerDto } from '~/shared/dto/pager.dto'
import { getRedisKey } from '~/utils/redis.util'
import { getTodayEarly, getWeekStart } from '~/utils/time.util'

import { AnalyzeDto } from './analyze.schema'
import { AnalyzeService } from './analyze.service'

@ApiController({ path: 'analyze' })
@Auth()
@ResponseV2()
export class AnalyzeController {
  constructor(
    private readonly service: AnalyzeService,
    private readonly redisService: RedisService,
  ) {}

  private async getOrSetCache<T>(
    key: string,
    ttlSeconds: number,
    getValue: () => Promise<T>,
  ): Promise<T> {
    const client = this.redisService.getClient()
    try {
      const cached = await client.get(key)
      if (cached) {
        try {
          return JSON.parse(cached) as T
        } catch {
          await client.del(key)
        }
      }
    } catch {
      // Redis unavailable, fall through to recalculate
    }

    const value = await getValue()
    try {
      await client.set(key, JSON.stringify(value))
      await client.expire(key, ttlSeconds)
    } catch {
      // Redis write failure, return value anyway
    }
    return value
  }

  @Get('/')
  async getAnalyze(@Query() query: AnalyzeDto & Partial<PagerDto>) {
    const { from, to = new Date(), page = 1, size = 50 } = query

    const data = await this.service.getRangeAnalyzeData(from, to, {
      limit: Math.trunc(size),
      page,
    })
    return data
  }

  @Get('/today')
  async getAnalyzeToday(@Query() query: Partial<PagerDto>) {
    const { page = 1, size = 50 } = query
    const today = new Date()
    const todayEarly = getTodayEarly(today)
    const data = await this.service.getRangeAnalyzeData(todayEarly, today, {
      limit: Math.trunc(size),
      page,
    })
    return data
  }

  @Get('/week')
  async getAnalyzeWeek(@Query() query: Partial<PagerDto>) {
    const { page = 1, size = 50 } = query
    const today = new Date()
    const weekStart = getWeekStart(today)
    const data = await this.service.getRangeAnalyzeData(weekStart, today, {
      limit: size,
      page,
    })
    return data
  }

  @Get('/aggregate')
  async getFragment() {
    const cacheKey = getRedisKey(RedisKeys.AnalyzeAggregate)
    const data = await this.getOrSetCache(cacheKey, 60, async () => {
      const getIpAndPvAggregate = async () => {
        const now = new Date()
        const todayEarly = getTodayEarly(now)
        const day = await this.service.getIpAndPvAggregateByRange(
          {
            from: todayEarly,
            to: now,
            granularity: 'hour',
          },
          true,
        )

        const dayData = Array.from({ length: 24 }, (_, i) => {
          const hour = i.toString().padStart(2, '0')
          const bucket = day[hour]
          const label = `${i}时`
          return [
            { hour: label, key: 'ip', value: bucket?.ip || 0 },
            { hour: label, key: 'pv', value: bucket?.pv || 0 },
          ]
        })

        const rangeStart = dayjs().subtract(29, 'day').startOf('day').toDate()
        const all = (await this.service.getIpAndPvAggregateByRange({
          from: rangeStart,
          to: now,
          granularity: 'date',
        })) as any[]

        const weekDayLabels = ['日', '一', '二', '三', '四', '五', '六']
        const weekData = all
          .slice(0, 7)
          .map((item) => {
            const day = `周${weekDayLabels[dayjs(item.date).get('day')]}`
            return [
              { day, key: 'ip', value: item.ip },
              { day, key: 'pv', value: item.pv },
            ]
          })
          .toReversed()

        const monthData = all
          .slice(0, 30)
          .map((item) => {
            const date = item.date.split('-').slice(1, 3).join('-')
            return [
              { date, key: 'ip', value: item.ip },
              { date, key: 'pv', value: item.pv },
            ]
          })
          .toReversed()

        return { dayData, weekData, monthData }
      }
      const [paths, total, today_ips, { dayData, monthData, weekData }] =
        await Promise.all([
          this.service.getRangeOfTopPathVisitor(),
          this.service.getCallTime(),
          this.service.getTodayAccessIp(),
          getIpAndPvAggregate(),
        ])
      return {
        today: dayData.flat(),
        weeks: weekData.flat(),
        months: monthData.flat(),
        paths,

        total,
        today_ips,
      }
    })
    return data
  }

  @Get('/like')
  async getTodayLikedArticle() {
    const client = this.redisService.getClient()
    const keys = await client.keys(getRedisKey(RedisKeys.Like, '*'))

    const data = await Promise.all(
      keys.map(async (key) => {
        const id = key.split('_').pop()!

        return {
          id,
          ips: await client.smembers(getRedisKey(RedisKeys.Like, id)),
        }
      }),
    )
    return data
  }

  @Get('/traffic-source')
  async getTrafficSource(@Query() query: AnalyzeDto) {
    const { from, to } = query
    const cacheKey = getRedisKey(
      RedisKeys.AnalyzeTrafficSource,
      ...rangeToCacheParts(from, to),
    )
    const data = await this.getOrSetCache(cacheKey, 300, () =>
      this.service.getTrafficSource(from, to),
    )
    return data
  }

  @Get('/device')
  async getDeviceDistribution(@Query() query: AnalyzeDto) {
    const { from, to } = query
    const cacheKey = getRedisKey(
      RedisKeys.AnalyzeDeviceDistribution,
      ...rangeToCacheParts(from, to),
    )
    const data = await this.getOrSetCache(cacheKey, 300, () =>
      this.service.getDeviceDistribution(from, to),
    )
    return data
  }

  @Delete('/')
  @HttpCode(204)
  async clearAnalyze(@Query() query: AnalyzeDto) {
    const { from = new Date('2020-01-01'), to = new Date() } = query
    await this.service.cleanAnalyzeRange({ from, to })
  }
}

function rangeToCacheParts(from?: Date, to?: Date): [string, string] {
  return [
    String(from?.getTime() ?? 'default'),
    String(to?.getTime() ?? 'default'),
  ]
}
