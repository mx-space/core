import { Readable } from 'node:stream'
import { URL } from 'node:url'

import { Injectable, Logger } from '@nestjs/common'
import { customAlphabet } from 'nanoid'

import { AppErrorCode, createAppException } from '~/common/errors'
import { alphabet } from '~/constants/other.constant'
import { HttpService } from '~/processors/helper/helper.http.service'
import { validateImageBuffer } from '~/utils/image.util'

import { ConfigsService } from '../configs/configs.service'
import { FileService } from '../file/file.service'
import type { FileType } from '../file/file.type'
import { LinkRepository } from './link.repository'
import { type LinkRow, LinkState } from './link.types'

const AVATAR_TYPE: FileType = 'avatar'

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/x-icon',
])

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.ico',
])

@Injectable()
export class LinkAvatarService {
  private readonly logger: Logger

  constructor(
    private readonly linkRepository: LinkRepository,
    private readonly configsService: ConfigsService,
    private readonly fileService: FileService,
    private readonly http: HttpService,
  ) {
    this.logger = new Logger(LinkAvatarService.name)
  }

  async convertToInternal(link: string | LinkRow): Promise<boolean> {
    const doc =
      typeof link === 'string' ? await this.linkRepository.findById(link) : link
    if (!doc) {
      if (typeof link === 'string') {
        throw createAppException(AppErrorCode.LINK_NOT_FOUND, { id: link })
      }
      return false
    }

    const avatar = doc.avatar
    if (!avatar || !this.isExternalAvatar(avatar)) {
      return false
    }

    const { url: configUrl, friendLinkOptions } =
      await this.configsService.waitForConfigReady()

    if (!friendLinkOptions.enableAvatarInternalization) {
      return false
    }

    const { webUrl } = configUrl

    const refererHeader = (() => {
      try {
        if (doc.url) {
          return new URL(doc.url).origin
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to parse the site URL for friend link ${doc.id}: ${error?.message || String(error)}`,
        )
      }
      return webUrl
    })()

    const response = await this.http.axiosRef.get<ArrayBuffer>(avatar, {
      responseType: 'arraybuffer',
      timeout: 10_000,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        referer: refererHeader,
      },
    })

    const buffer = Buffer.from(response.data as any)
    const contentType = (response.headers['content-type'] ||
      response.headers['Content-Type']) as string | undefined
    const normalizedContentType = this.normalizeMimeType(contentType)

    if (
      !normalizedContentType ||
      !this.isAllowedMimeType(normalizedContentType)
    ) {
      this.logger.warn(
        `Friend link ${doc.id} avatar response type ${contentType || 'unknown'} is not a supported image format; skipping internalization`,
      )
      return false
    }

    const validation = validateImageBuffer({
      originUrl: avatar,
      buffer,
      allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    })

    if (!validation.ok) {
      throw createAppException(AppErrorCode.LINK_AVATAR_VALIDATION_FAILED, {
        reason: validation.reason,
      })
    }

    const { ext } = validation

    const filename = customAlphabet(alphabet)(18) + ext.toLowerCase()

    await this.fileService.writeFile(
      AVATAR_TYPE,
      filename,
      Readable.from(buffer),
    )

    const internalUrl = await this.fileService.resolveFileUrl(
      AVATAR_TYPE,
      filename,
    )

    await this.linkRepository.updateAvatar(doc.id, internalUrl)

    this.logger.log(`Friend link ${doc.id} avatar has been internalized`)

    return true
  }

  async migratePassedLinks(): Promise<{
    updatedCount: number
    updatedIds: string[]
  }> {
    const { friendLinkOptions } = await this.configsService.waitForConfigReady()
    if (!friendLinkOptions.enableAvatarInternalization) {
      return { updatedCount: 0, updatedIds: [] }
    }

    const links = await this.linkRepository.findByState(LinkState.Pass)
    const updatedIds: string[] = []

    for (const link of links) {
      try {
        if (this.isExternalAvatar(link.avatar)) {
          const converted = await this.convertToInternal(link.id)
          if (converted) {
            updatedIds.push(link.id)
          }
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to migrate friend link avatar: ${link.id} - ${error?.message || String(error)}`,
        )
      }
    }

    return { updatedCount: updatedIds.length, updatedIds }
  }

  private isExternalAvatar(avatar: string | undefined | null): boolean {
    if (!avatar) return false
    try {
      new URL(avatar)
    } catch {
      return false
    }
    if (avatar.includes('/objects/avatar/')) {
      return false
    }
    return true
  }

  private normalizeMimeType(mime?: string): string | undefined {
    if (!mime) return undefined
    return mime.split(';')[0].trim().toLowerCase()
  }

  private isAllowedMimeType(mime: string): boolean {
    return ALLOWED_IMAGE_MIME_TYPES.has(mime)
  }
}
