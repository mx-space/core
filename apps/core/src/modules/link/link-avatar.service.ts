import { Readable } from 'node:stream'
import { URL } from 'node:url'

import { Injectable, Logger } from '@nestjs/common'
import { customAlphabet } from 'nanoid'
import type { FetchResponse } from 'ofetch'

import { AppErrorCode, createAppException } from '~/common/errors'
import { alphabet } from '~/constants/other.constant'
import { HttpService } from '~/processors/helper/helper.http.service'
import { validateImageBuffer } from '~/utils/image.util'
import { AsyncQueue } from '~/utils/queue.util'
import { assertPublicHttpUrl } from '~/utils/ssrf.util'

import { ConfigsService } from '../configs/configs.service'
import { FileService } from '../file/file.service'
import type { FileType } from '../file/file.type'
import { LinkRepository } from './link.repository'
import { type LinkRow, LinkState } from './link.types'

const AVATAR_TYPE: FileType = 'avatar'

const MIGRATE_CONCURRENCY = 4

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

    // SSRF guard: the avatar URL is applicant-controlled. Reject targets that
    // resolve to internal/metadata addresses before issuing the request, and
    // disable redirect following so a public host cannot 30x us into one.
    try {
      await assertPublicHttpUrl(avatar, { allowHttp: true })
    } catch (error: any) {
      this.logger.warn(
        `Friend link ${doc.id} avatar URL was rejected by the SSRF guard; skipping internalization: ${error?.message || String(error)}`,
      )
      return false
    }

    let response: FetchResponse<ArrayBuffer>
    try {
      response = await this.http.fetch.raw<ArrayBuffer, 'arrayBuffer'>(avatar, {
        responseType: 'arrayBuffer',
        timeout: 10_000,
        redirect: 'error',
        retry: 0,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          referer: refererHeader,
        },
      })
    } catch (error: any) {
      this.logger.warn(
        `Failed to fetch friend link ${doc.id} avatar; skipping internalization: ${error?.message || String(error)}`,
      )
      return false
    }

    const buffer = Buffer.from(response._data as ArrayBuffer)
    const contentType = response.headers.get('content-type') ?? undefined
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

    const { results } = await AsyncQueue.runAll(
      links,
      async (link) => {
        try {
          if (
            this.isExternalAvatar(link.avatar) &&
            (await this.convertToInternal(link.id))
          ) {
            return link.id
          }
        } catch (error: any) {
          this.logger.error(
            `Failed to migrate friend link avatar: ${link.id} - ${error?.message || String(error)}`,
          )
        }
        return null
      },
      MIGRATE_CONCURRENCY,
    )
    const updatedIds = results.filter(
      (id): id is string => typeof id === 'string',
    )

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
