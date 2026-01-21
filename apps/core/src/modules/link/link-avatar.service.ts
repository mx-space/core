import { Readable } from 'node:stream'
import { URL } from 'node:url'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { DocumentType } from '@typegoose/typegoose'
import { alphabet } from '~/constants/other.constant'
import { HttpService } from '~/processors/helper/helper.http.service'
import { InjectModel } from '~/transformers/model.transformer'
import { validateImageBuffer } from '~/utils/image.util'
import { customAlphabet } from 'nanoid'
import { ConfigsService } from '../configs/configs.service'
import { FileService } from '../file/file.service'
import type { FileType } from '../file/file.type'
import { LinkModel, LinkState } from './link.model'

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
    @InjectModel(LinkModel)
    private readonly linkModel: MongooseModel<LinkModel>,
    private readonly configsService: ConfigsService,
    private readonly fileService: FileService,
    private readonly http: HttpService,
  ) {
    this.logger = new Logger(LinkAvatarService.name)
  }

  async convertToInternal(
    link: string | DocumentType<LinkModel>,
  ): Promise<boolean> {
    const doc =
      typeof link === 'string' ? await this.linkModel.findById(link) : link
    if (!doc) {
      if (typeof link === 'string') {
        throw new NotFoundException()
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
          `解析友链 ${doc._id} 的站点地址失败: ${error?.message || String(error)}`,
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
        `友链 ${doc._id} 头像响应类型 ${contentType || 'unknown'} 不在受支持图片范围，跳过内链转换`,
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
      throw new BadRequestException(validation.reason)
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

    doc.avatar = internalUrl
    await doc.save()

    this.logger.log(`友链 ${doc._id} 头像已转换为内部链接`)

    return true
  }

  async migratePassedLinks(): Promise<{
    updatedCount: number
    updatedIds: string[]
  }> {
    const { friendLinkOptions } = await this.configsService.waitForConfigReady()
    if (!friendLinkOptions.enableAvatarInternalization) {
      return {
        updatedCount: 0,
        updatedIds: [],
      }
    }

    const links = await this.linkModel
      .find({
        state: LinkState.Pass,
        avatar: { $exists: true, $ne: null },
      })
      .lean()

    const updatedIds: string[] = []

    for (const link of links) {
      try {
        if (this.isExternalAvatar(link.avatar as string)) {
          const converted = await this.convertToInternal(String(link._id))
          if (converted) {
            updatedIds.push(String(link._id))
          }
        }
      } catch (error: any) {
        this.logger.error(
          `迁移友链头像失败: ${link._id} - ${error?.message || String(error)}`,
        )
      }
    }

    return {
      updatedCount: updatedIds.length,
      updatedIds,
    }
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
