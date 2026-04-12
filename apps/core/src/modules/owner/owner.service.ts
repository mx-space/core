import { Injectable, Logger } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose'
import { Types } from 'mongoose'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import {
  OWNER_PROFILE_COLLECTION_NAME,
  READER_COLLECTION_NAME,
} from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { normalizeDocumentIds } from '~/shared/model/plugins/lean-id'
import { InjectModel } from '~/transformers/model.transformer'
import { getAvatar } from '~/utils/tool.util'

import type { OwnerDocument } from './owner.model'
import { OwnerModel } from './owner.model'
import { OwnerProfileModel } from './owner-profile.model'

@Injectable()
export class OwnerService {
  private logger = new Logger(OwnerService.name)

  constructor(
    private readonly databaseService: DatabaseService,
    @InjectModel(OwnerProfileModel)
    private readonly ownerProfileModel: ReturnModelType<
      typeof OwnerProfileModel
    >,
    private readonly eventManager: EventManagerService,
  ) {}

  private get readersCollection() {
    return this.databaseService.db.collection(READER_COLLECTION_NAME)
  }

  private get ownerProfileCollection() {
    return this.databaseService.db.collection(OWNER_PROFILE_COLLECTION_NAME)
  }

  private async getOwnerReader() {
    return this.readersCollection
      .find({ role: 'owner' })
      .sort({ createdAt: 1, _id: 1 })
      .limit(1)
      .next()
  }

  private async getOwnerProfile(
    readerId: string | Types.ObjectId,
    withIp: boolean,
  ) {
    const objectId =
      typeof readerId === 'string' && Types.ObjectId.isValid(readerId)
        ? new Types.ObjectId(readerId)
        : readerId
    const projection = withIp
      ? undefined
      : {
          lastLoginIp: 0,
        }
    return this.ownerProfileCollection.findOne(
      { readerId: objectId },
      projection ? { projection } : undefined,
    )
  }

  private toOwnerModel(reader: any, profile: any): OwnerDocument {
    const normalizedReader = reader ? normalizeDocumentIds({ ...reader }) : null
    const mail = profile?.mail ?? reader?.email ?? ''
    const avatar =
      normalizedReader?.image ??
      getAvatar(
        mail ||
          normalizedReader?.email ||
          normalizedReader?.username ||
          'owner@local',
      )

    return {
      id: normalizedReader?.id ?? '',
      username: normalizedReader?.username ?? normalizedReader?.handle ?? '',
      name:
        normalizedReader?.name ??
        normalizedReader?.displayUsername ??
        normalizedReader?.username ??
        normalizedReader?.handle ??
        'owner',
      introduce: profile?.introduce,
      avatar,
      mail,
      url: profile?.url,
      lastLoginTime: profile?.lastLoginTime,
      lastLoginIp: profile?.lastLoginIp,
      socialIds: profile?.socialIds,
      role: 'owner',
      email: normalizedReader?.email,
      image: normalizedReader?.image,
      handle: normalizedReader?.handle,
      displayUsername: normalizedReader?.displayUsername,
      created: normalizedReader?.createdAt ?? profile?.created,
    }
  }

  async getOwnerInfo(getLoginIp = false) {
    const reader = await this.getOwnerReader()
    if (!reader) {
      throw new BizException(ErrorCodeEnum.MasterLost)
    }

    const profile = await this.getOwnerProfile(reader._id, getLoginIp)
    return this.toOwnerModel(reader, profile)
  }

  async hasOwner() {
    return (await this.readersCollection.countDocuments({ role: 'owner' })) > 0
  }

  public async getOwner() {
    const owner = await this.getOwnerInfo()
    if (!owner) {
      throw new BizException(ErrorCodeEnum.UserNotExists)
    }
    return owner
  }

  async patchOwnerData(data: Partial<OwnerModel>) {
    const reader = await this.getOwnerReader()
    if (!reader?._id) {
      throw new BizException(ErrorCodeEnum.MasterLost)
    }

    const readerPatch: Record<string, any> = {}
    if (typeof data.name === 'string' && data.name.length > 0) {
      readerPatch.name = data.name
    }
    if (typeof data.avatar === 'string' && data.avatar.length > 0) {
      readerPatch.image = data.avatar
    }

    const hasReaderPatch = Object.keys(readerPatch).length > 0
    if (hasReaderPatch) {
      readerPatch.updatedAt = new Date()
      await this.readersCollection.updateOne(
        { _id: reader._id },
        { $set: readerPatch },
      )
    }

    const profilePatch: Record<string, any> = {}
    if (data.introduce !== undefined) {
      profilePatch.introduce = data.introduce
    }
    if (data.mail !== undefined) {
      profilePatch.mail = data.mail
    }
    if (data.url !== undefined) {
      profilePatch.url = data.url
    }
    if (data.socialIds !== undefined) {
      profilePatch.socialIds = data.socialIds
    }

    const hasProfilePatch = Object.keys(profilePatch).length > 0
    if (hasProfilePatch) {
      await this.ownerProfileModel.updateOne(
        { readerId: reader._id },
        {
          $set: profilePatch,
          $setOnInsert: {
            readerId: reader._id,
            created: new Date(),
          },
        },
        { upsert: true },
      )
    }

    if (hasReaderPatch || hasProfilePatch) {
      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.emit(
          BusinessEvents.AGGREGATE_UPDATE,
          {
            source: 'owner',
            keys: ['user'],
          },
          {
            scope: EventScope.TO_SYSTEM,
          },
        ),
      ])
    }

    return this.getOwnerInfo(true)
  }

  async recordFootstep(
    ip: string,
  ): Promise<Record<string, Date | string | null>> {
    const reader = await this.getOwnerReader()
    if (!reader?._id) {
      throw new BizException(ErrorCodeEnum.MasterLost)
    }
    const profile = await this.getOwnerProfile(reader._id, true)
    const prevFootstep = {
      lastLoginTime: profile?.lastLoginTime || new Date(1586090559569),
      lastLoginIp: profile?.lastLoginIp || null,
    }

    await this.ownerProfileModel.updateOne(
      {
        readerId: reader._id,
      },
      {
        $set: {
          lastLoginTime: new Date(),
          lastLoginIp: ip,
        },
        $setOnInsert: {
          readerId: reader._id,
          created: new Date(),
        },
      },
      {
        upsert: true,
      },
    )

    this.logger.warn(`主人已登录，IP: ${ip}`)
    return prevFootstep
  }

  async isOwnerName(author: string) {
    if (!author) {
      return false
    }
    const owner = await this.getOwnerInfo().catch(() => null)
    if (!owner) {
      return false
    }
    const name = author.trim().toLowerCase()
    const candidates = [owner.name, owner.username, owner.handle]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
    return candidates.includes(name)
  }

  async getSiteOwnerOrMocked() {
    return this.getOwnerInfo().catch((error) => {
      if (
        error instanceof BizException &&
        error.bizCode === ErrorCodeEnum.MasterLost
      ) {
        return {
          id: '1',
          name: '站长大人',
          mail: 'example@owner.com',
          username: 'johndoe',
          created: new Date('2021/1/1 10:00:11'),
        } as OwnerModel
      }
      throw error
    })
  }
}
