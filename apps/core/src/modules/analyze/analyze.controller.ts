import dayjs from 'dayjs'
import type { PagerDto } from '~/shared/dto/pager.dto'

import { Delete, Get, HttpCode, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { Paginator } from '~/common/decorators/http.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/redis/cache.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { getTodayEarly, getWeekStart } from '~/utils/time.util'

import { AnalyzeDto } from './analyze.dto'
import { AnalyzeService } from './analyze.service'

@ApiController({ path: 'analyze' })
@Auth()
export class AnalyzeController {
  constructor(
    private readonly service: AnalyzeService,
    private readonly redisService: RedisService,
  ) {}

  @Get('/')
  @Paginator
  async getAnalyze(@Query() query: AnalyzeDto & Partial<PagerDto>) {
    const { from, to = new Date(), page = 1, size = 50 } = query

    const data = await this.service.getRangeAnalyzeData(from, to, {
      limit: Math.trunc(size),
      page,
    })

    return data
  }

  @Get('/today')
  @Paginator
  async getAnalyzeToday(@Query() query: Partial<PagerDto>) {
    const { page = 1, size = 50 } = query
    const today = new Date()
    const todayEarly = getTodayEarly(today)
    return await this.service.getRangeAnalyzeData(todayEarly, today, {
      limit: Math.trunc(size),
      page,
    })
  }

  @Get('/week')
  @Paginator
  async getAnalyzeWeek(@Query() query: Partial<PagerDto>) {
    const { page = 1, size = 50 } = query
    const today = new Date()
    const weekStart = getWeekStart(today)
    return await this.service.getRangeAnalyzeData(weekStart, today, {
      limit: size,
      page,
    })
  }

  @Get('/aggregate')
  async getFragment() {
    const getIpAndPvAggregate = async () => {
      const day = await this.service.getIpAndPvAggregate('day', true)

      const dayData = Array.from({ length: 24 })
        .fill(undefined)
        .map((v, i) => {
          return [
            {
              hour: `${i}时`,
              key: 'ip',
              value: day[i.toString().padStart(2, '0')]?.ip || 0,
            },
            {
              hour: `${i}时`,
              key: 'pv',
              value: day[i.toString().padStart(2, '0')]?.pv || 0,
            },
          ]
        })
      const all = (await this.service.getIpAndPvAggregate('all')) as any[]

      const weekData = all
        .slice(0, 7)
        .map((item) => {
          const date = `周${
            ['日', '一', '二', '三', '四', '五', '六'][
              dayjs(item.date).get('day')
            ]
          }`
          return [
            {
              day: date,
              key: 'ip',
              value: item.ip,
            },
            {
              day: date,
              key: 'pv',
              value: item.pv,
            },
          ]
        })
        .reverse()

      const monthData = all
        .slice(0, 30)
        .map((item) => {
          return [
            {
              date: item.date.split('-').slice(1, 3).join('-'),
              key: 'ip',
              value: item.ip,
            },
            {
              date: item.date.split('-').slice(1, 3).join('-'),
              key: 'pv',
              value: item.pv,
            },
          ]
        })
        .reverse()
      return {
        dayData,
        weekData,
        monthData,
      }
    }
    const [paths, total, today_ips, { dayData, monthData, weekData }] =
      await Promise.all([
        this.service.getRangeOfTopPathVisitor(),
        this.service.getCallTime(),
        this.service.getTodayAccessIp(),
        getIpAndPvAggregate(),
      ])
    return {
      today: dayData.flat(1),
      weeks: weekData.flat(1),
      months: monthData.flat(1),
      paths: paths.slice(50),

      total,
      today_ips,
    }
  }

  @Get('/like')
  async getTodayLikedArticle() {
    const client = this.redisService.getClient()
    const keys = await client.keys(getRedisKey(RedisKeys.Like, '*'))

    return Promise.all(
      keys.map(async (key) => {
        const id = key.split('_').pop()!

        return {
          id,
          ips: await client.smembers(getRedisKey(RedisKeys.Like, id)),
        }
      }),
    )
  }

  @Delete('/')
  @HttpCode(204)
  async clearAnalyze(@Query() query: AnalyzeDto) {
    const { from = new Date('2020-01-01'), to = new Date() } = query
    await this.service.cleanAnalyzeRange({ from, to })
    return
  }
}
