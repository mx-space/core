import { Injectable, Logger } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { getAvatar } from '~/utils/tool.util'

import { ReaderRepository, type ReaderRow } from '../reader/reader.repository'
import { type OwnerProfileRow, OwnerRepository } from './owner.repository'
import type { OwnerDocument } from './owner.types'
import { OwnerModel } from './owner.types'

@Injectable()
export class OwnerService {
  private logger = new Logger(OwnerService.name)

  constructor(
    private readonly readerRepository: ReaderRepository,
    private readonly ownerRepository: OwnerRepository,
    private readonly eventManager: EventManagerService,
  ) {}

  private async getOwnerReader() {
    return this.readerRepository.findOwner()
  }

  private async getOwnerProfile(readerId: string, withIp: boolean) {
    const profile = await this.ownerRepository.findByReaderId(readerId)
    if (profile && !withIp) {
      return { ...profile, lastLoginIp: null }
    }
    return profile
  }

  private toOwnerModel(
    reader: ReaderRow,
    profile: OwnerProfileRow | null | undefined,
  ): OwnerDocument {
    const mail = profile?.mail ?? reader?.email ?? ''
    const avatar =
      reader?.image ??
      getAvatar(mail || reader?.email || reader?.username || 'owner@local')

    return {
      id: reader.id,
      _id: reader.id,

      username: reader?.username ?? reader?.handle ?? '',
      name:
        reader?.name ??
        reader?.displayUsername ??
        reader?.username ??
        reader?.handle ??
        'owner',
      introduce: profile?.introduce ?? undefined,
      avatar,
      mail,
      url: profile?.url ?? undefined,
      lastLoginTime: profile?.lastLoginTime ?? undefined,
      lastLoginIp: profile?.lastLoginIp ?? undefined,
      socialIds: profile?.socialIds ?? undefined,
      role: 'owner',
      email: reader?.email ?? undefined,
      image: reader?.image ?? undefined,
      handle: reader?.handle ?? undefined,
      displayUsername: reader?.displayUsername ?? undefined,
      created: reader?.createdAt ?? profile?.createdAt,
    }
  }

  async getOwnerInfo(getLoginIp = false) {
    const reader = await this.getOwnerReader()
    if (!reader) {
      throw new BizException(ErrorCodeEnum.MasterLost)
    }

    const profile = await this.getOwnerProfile(reader.id, getLoginIp)
    return this.toOwnerModel(reader, profile)
  }

  async hasOwner() {
    return !!(await this.getOwnerReader())
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
    if (!reader?.id) {
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
      await this.readerRepository.update(reader.id, readerPatch)
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
      await this.ownerRepository.upsertByReaderId(reader.id, profilePatch)
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
    if (!reader?.id) {
      throw new BizException(ErrorCodeEnum.MasterLost)
    }
    const profile = await this.getOwnerProfile(reader.id, true)
    const prevFootstep = {
      lastLoginTime: profile?.lastLoginTime || new Date(1586090559569),
      lastLoginIp: profile?.lastLoginIp || null,
    }

    await this.ownerRepository.upsertByReaderId(reader.id, {
      lastLoginTime: new Date(),
      lastLoginIp: ip,
    })

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
