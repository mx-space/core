import dayjs from 'dayjs'
import { merge } from 'lodash'
import type { PipelineStage } from 'mongoose'

import { Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'

import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/redis/cache.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'

import { OptionModel } from '../configs/configs.model'
import { AnalyzeModel } from './analyze.model'

@Injectable()
export class AnalyzeService {
  constructor(
    @InjectModel(OptionModel)
    private readonly options: ReturnModelType<typeof OptionModel>,
    @InjectModel(AnalyzeModel)
    private readonly analyzeModel: MongooseModel<AnalyzeModel>,
    private readonly redisService: RedisService,
  ) {}

  public get model() {
    return this.analyzeModel
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
    const condition = {
      $and: [
        {
          timestamp: {
            $gte: from,
          },
        },
        {
          timestamp: {
            $lte: to,
          },
        },
      ],
    }

    return await this.analyzeModel.paginate(condition, {
      sort: { timestamp: -1 },
      page,
      limit,
    })
  }

  async getCallTime() {
    const callTime =
      (
        await this.options
          .findOne({
            name: 'apiCallTime',
          })
          .lean()
      )?.value || 0

    const uv =
      (
        await this.options
          .findOne({
            name: 'uv',
          })
          .lean()
      )?.value || 0

    return { callTime, uv }
  }
  async cleanAnalyzeRange(range: { from?: Date; to?: Date }) {
    const { from, to } = range

    await this.analyzeModel.deleteMany({
      $and: [
        {
          timestamp: {
            $gte: from,
          },
        },
        {
          timestamp: {
            $lte: to,
          },
        },
      ],
    })
  }

  async getIpAndPvAggregate(
    type: 'day' | 'week' | 'month' | 'all',
    returnObj?: boolean,
  ) {
    let cond = {}
    const now = dayjs()
    const beforeDawn = now.set('minute', 0).set('second', 0).set('hour', 0)
    switch (type) {
      case 'day': {
        cond = {
          timestamp: {
            $gte: beforeDawn.toDate(),
          },
        }
        break
      }
      case 'month': {
        cond = {
          timestamp: {
            $gte: beforeDawn.set('day', -30).toDate(),
          },
        }
        break
      }
      case 'week': {
        cond = {
          timestamp: {
            $gte: beforeDawn.set('day', -7).toDate(),
          },
        }
        break
      }
      case 'all':
      default: {
        break
      }
    }

    const [res, res2] = await Promise.all([
      this.analyzeModel.aggregate([
        { $match: cond },
        {
          $project: {
            _id: 1,
            timestamp: 1,
            hour: {
              $dateToString: {
                format: '%H',
                date: { $subtract: ['$timestamp', 0] },
                timezone: '+08:00',
              },
            },
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $subtract: ['$timestamp', 0] },
                timezone: '+08:00',
              },
            },
          },
        },
        {
          $group: {
            _id: type === 'day' ? '$hour' : '$date',

            pv: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            ...(type === 'day' ? { hour: '$_id' } : { date: '$_id' }),
            pv: 1,
          },
        },
        {
          $sort: {
            date: -1,
          },
        },
      ]),
      this.analyzeModel.aggregate([
        { $match: cond },
        {
          $project: {
            _id: 1,
            timestamp: 1,
            ip: 1,
            hour: {
              $dateToString: {
                format: '%H',
                date: { $subtract: ['$timestamp', 0] },
                timezone: '+08:00',
              },
            },
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $subtract: ['$timestamp', 0] },
                timezone: '+08:00',
              },
            },
          },
        },
        {
          $group: {
            _id:
              type === 'day'
                ? { ip: '$ip', hour: '$hour' }
                : { ip: '$ip', date: '$date' },
          },
        },

        {
          $group: {
            _id: type === 'day' ? '$_id.hour' : '$_id.date',
            ip: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            ...(type === 'day' ? { hour: '$_id' } : { date: '$_id' }),
            ip: 1,
          },
        },
        {
          $sort: {
            date: -1,
          },
        },
      ]),
    ])
    const arr = merge(res, res2)
    if (returnObj) {
      const obj = {}
      for (const item of arr) {
        obj[item.hour || item.date] = item
      }

      return obj
    }
    return arr
  }

  async getRangeOfTopPathVisitor(from?: Date, to?: Date): Promise<any[]> {
    from = from ?? new Date(Date.now() - 1000 * 24 * 3600 * 7)
    to = to ?? new Date()

    const pipeline: PipelineStage[] = [
      {
        $match: {
          timestamp: {
            $gte: from,
            $lte: to,
          },
        },
      },
      {
        $group: {
          _id: '$path',
          count: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },
      {
        $project: {
          _id: 0,
          path: '$_id',
          count: 1,
        },
      },
    ]

    const res = await this.analyzeModel.aggregate(pipeline).exec()

    return res
  }

  async getTodayAccessIp(): Promise<string[]> {
    const redis = this.redisService.getClient()
    const fromRedisIps = await redis.smembers(getRedisKey(RedisKeys.AccessIp))

    return fromRedisIps
  }
}
