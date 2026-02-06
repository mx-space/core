import { Injectable, Logger } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose'
import {
  BizException,
  BusinessException,
} from '~/common/exceptions/biz.exception'
import { OWNER_PROFILE_COLLECTION_NAME } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getAvatar } from '~/utils/tool.util'
import { Types } from 'mongoose'
import { AUTH_JS_USER_COLLECTION } from '../auth/auth.constant'
import { OwnerProfileModel } from './owner-profile.model'
import type { OwnerDocument } from './owner.model'
import { OwnerModel } from './owner.model'

@Injectable()
export class OwnerService {
  private logger = new Logger(OwnerService.name)

  constructor(
    private readonly databaseService: DatabaseService,
    @InjectModel(OwnerProfileModel)
    private readonly ownerProfileModel: ReturnModelType<
      typeof OwnerProfileModel
    >,
  ) {}

  private get readersCollection() {
    return this.databaseService.db.collection(AUTH_JS_USER_COLLECTION)
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
    const mail = profile?.mail ?? reader?.email ?? ''
    const avatar =
      reader?.image ??
      getAvatar(mail || reader?.email || reader?.username || 'owner@local')

    return {
      id: reader?._id?.toString?.() || reader?.id || '',
      _id: reader?._id,

      username: reader?.username ?? reader?.handle ?? '',
      name:
        reader?.name ??
        reader?.displayUsername ??
        reader?.username ??
        reader?.handle ??
        'owner',
      introduce: profile?.introduce,
      avatar,
      mail,
      url: profile?.url,
      lastLoginTime: profile?.lastLoginTime,
      lastLoginIp: profile?.lastLoginIp,
      socialIds: profile?.socialIds,
      role: 'owner',
      email: reader?.email,
      image: reader?.image,
      handle: reader?.handle,
      displayUsername: reader?.displayUsername,
      created: reader?.createdAt ?? profile?.created,
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
      throw new BusinessException(ErrorCodeEnum.MasterLost)
    }

    const readerPatch: Record<string, any> = {}
    if (typeof data.name === 'string' && data.name.length > 0) {
      readerPatch.name = data.name
    }
    if (typeof data.avatar === 'string' && data.avatar.length > 0) {
      readerPatch.image = data.avatar
    }

    if (Object.keys(readerPatch).length > 0) {
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

    if (Object.keys(profilePatch).length > 0) {
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

    return this.getOwnerInfo(true)
  }

  async recordFootstep(
    ip: string,
  ): Promise<Record<string, Date | string | null>> {
    const reader = await this.getOwnerReader()
    if (!reader?._id) {
      throw new BusinessException(ErrorCodeEnum.MasterLost)
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
    return await this.getOwnerInfo().catch((error) => {
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
