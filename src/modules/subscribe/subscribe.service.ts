import cluster from 'cluster'
import { nanoid } from 'nanoid'

import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { isMainProcess } from '~/global/env.global'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { hashString, md5 } from '~/utils'

import { NoteModel } from '../note/note.model'
import {
  SubscribeNoteCreateBit,
  SubscribeTypeToBitMap,
} from './subscribe.constant'
import { SubscribeModel } from './subscribe.model'

declare type Email = string
declare type Subscribe = number

@Injectable()
export class SubscribeService implements OnModuleInit {
  constructor(
    @InjectModel(SubscribeModel)
    private readonly subscribeModel: MongooseModel<SubscribeModel>,

    private readonly eventManager: EventManagerService,
  ) {}

  private subscribeMap = new Map<Email, Subscribe>()
  get model() {
    return this.subscribeModel
  }

  async onModuleInit() {
    if (!isMainProcess && cluster.isWorker && cluster.worker?.id !== 1) return
    // init from db

    const models = await this.model.find().lean()
    for (const model of models) {
      this.subscribeMap.set(model.email, model.subscribe)
    }

    const scopeCfg = { scope: EventScope.TO_VISITOR }
    this.eventManager.on(
      BusinessEvents.NOTE_CREATE,
      async (note: NoteModel) => {
        for (const [email, subscribe] of this.subscribeMap.entries()) {
          if (subscribe & SubscribeNoteCreateBit) this.sendEmail(email)
        }
      },
      scopeCfg,
    )

    this.eventManager.on(BusinessEvents.POST_CREATE, async () => {}, scopeCfg)

    this.eventManager.on(BusinessEvents.SAY_CREATE, async () => {}, scopeCfg)

    this.eventManager.on(
      BusinessEvents.RECENTLY_CREATE,
      async () => {},
      scopeCfg,
    )
  }

  async subscribe(email: string, subscribe: number) {
    const isExist = await this.model
      .findOne({
        email,
      })
      .lean()

    if (isExist) {
      await this.model.updateOne(
        {
          email,
        },
        {
          $set: {
            subscribe,
          },
        },
      )
    } else {
      const token = this.createCancelToken(email)
      await this.model.create({
        email,
        subscribe,
        cancelToken: token,
      })
    }

    this.subscribeMap.set(email, subscribe)

    // event subscribe update
  }

  async unsubscribe(email: string, token: string) {
    const model = await this.model
      .findOne({
        email,
      })
      .lean()
    if (!model) {
      return false
    }
    if (model.cancelToken === token) {
      await this.model.deleteOne({ email })

      this.subscribeMap.delete(email)

      return true
    }
  }

  createCancelToken(email: string) {
    return hashString(md5(email) + nanoid(8))
  }

  subscribeTypeToBit(type: keyof typeof SubscribeTypeToBitMap) {
    if (!Object.keys(SubscribeTypeToBitMap).includes(type))
      throw new BadRequestException('subscribe type is not valid')
    return SubscribeTypeToBitMap[type]
  }

  async sendEmail(email) {
    console.log('send')
  }
}
