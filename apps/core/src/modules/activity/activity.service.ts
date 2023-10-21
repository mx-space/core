import { pick } from 'lodash'
import { Types } from 'mongoose'
import type { Collection } from 'mongodb'
import type {
  ActivityLikePayload,
  ActivityLikeSupportType,
} from './activity.interface'

import { BadRequestException, Injectable } from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'

import { Activity } from './activity.constant'
import { ActivityModel } from './activity.model'

@Injectable()
export class ActivityService {
  constructor(
    private readonly countingService: CountingService,

    private readonly eventService: EventManagerService,

    @InjectModel(ActivityModel)
    private readonly activityModel: MongooseModel<ActivityModel>,
    private readonly databaseService: DatabaseService,
  ) {}

  get model() {
    return this.activityModel
  }

  async getLikeActivities(page = 1, size = 10) {
    const activities = await this.model.paginate(
      {
        type: Activity.Like,
      },
      {
        page,
        limit: size,
        sort: {
          created: -1,
        },
      },
    )

    const transformedPager = transformDataToPaginate(activities)
    const typedIdsMap = transformedPager.data.reduce(
      (acc, item) => {
        const { type, id } = item.payload as ActivityLikePayload

        switch (type) {
          case 'Note': {
            acc.Note.push(id)
            break
          }
          case 'Post': {
            acc.Post.push(id)

            break
          }
        }
        return acc
      },
      {
        Post: [],
        Note: [],
      } as Record<ActivityLikeSupportType, string[]>,
    )

    const type2Collection: Record<
      ActivityLikeSupportType,
      Collection<Document>
    > = {
      Note: this.databaseService.db.collection('notes'),
      Post: this.databaseService.db.collection('posts'),
    }

    const refModelData = new Map<string, any>()
    for (const [type, ids] of Object.entries(typedIdsMap)) {
      const collection = type2Collection[type as ActivityLikeSupportType]
      const docs = await collection
        .find(
          {
            _id: {
              $in: ids.map((id) => new Types.ObjectId(id)),
            },
          },
          {
            projection: {
              text: 0,
            },
          },
        )
        .toArray()

      for (const doc of docs) {
        refModelData.set(doc._id.toHexString(), doc)
      }
    }

    const docsWithRefModel = activities.docs.map((ac) => {
      const nextAc = ac.toJSON()
      Reflect.set(nextAc, 'ref', refModelData.get(ac.payload.id))

      return nextAc
    })

    // @ts-ignore
    transformedPager.data = docsWithRefModel
    return transformedPager
  }

  async likeAndEmit(type: ActivityLikeSupportType, id: string, ip: string) {
    try {
      const res = await this.countingService.updateLikeCountWithIp(type, id, ip)
      if (!res) {
        throw new BadRequestException('你已经支持过啦！')
      }
    } catch (e: any) {
      throw new BadRequestException(e)
    }

    const refModel = await this.databaseService
      .findGlobalById(id)
      .then((res) => res?.document)
    this.eventService.emit(
      BusinessEvents.ACTIVITY_LIKE,
      {
        id,
        type,
        ref: pick(refModel, [
          'id',
          '_id',
          'title',
          'nid',
          'slug',
          'category',
          'categoryId',
          'created',
        ]),
      },
      {
        scope: EventScope.TO_SYSTEM_ADMIN,
      },
    )

    await this.activityModel.create({
      type: Activity.Like,
      created: new Date(),
      payload: {
        ip,
        type,
        id,
      } as ActivityLikePayload,
    })
  }
}
