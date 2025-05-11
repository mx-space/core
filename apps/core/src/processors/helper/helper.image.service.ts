import { encode } from 'blurhash'
import type { ImageModel } from '~/shared/model/image.model'
import type { Sharp } from 'sharp'

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'
import { pickImagesFromMarkdown } from '~/utils/pic.util'
import { AsyncQueue } from '~/utils/queue.util'
import { requireDepsWithInstall } from '~/utils/tool.util'

import { HttpService } from './helper.http.service'

@Injectable()
export class ImageService implements OnModuleInit {
  private logger: Logger
  constructor(
    private readonly httpService: HttpService,
    private readonly configsService: ConfigsService,
  ) {
    this.logger = new Logger(ImageService.name)
  }

  onModuleInit() {
    requireDepsWithInstall('sharp').catch((error: any) => {
      this.logger.error(`sharp install failed: ${error.message}`)
      console.error(error)
    })
  }

  async saveImageDimensionsFromMarkdownText(
    text: string,
    originImages: ImageModel[] | undefined,
    onUpdate: (images: ImageModel[]) => Promise<any>,
  ) {
    const newImageSrcSet = new Set(pickImagesFromMarkdown(text))
    const newImages = [...newImageSrcSet]

    const result = [] as ImageModel[]

    const oldImagesMap = new Map(
      (originImages ?? []).map((image) => [image.src, { ...image }]),
    )

    const queue = new AsyncQueue(2)
    const imageProcessingTasks = newImages.map((src) => async () => {
      const originImage = oldImagesMap.get(src)
      const keys = new Set(Object.keys(originImage || {}))

      // 原有图片 和 现有图片 src 一致 跳过
      if (
        originImage &&
        originImage.src === src &&
        ['height', 'width', 'type', 'accent', 'blurHash'].every(
          (key) => keys.has(key) && originImage[key],
        )
      ) {
        result.push(originImage)
        return
      }

      try {
        this.logger.log(`Get --> ${src}`)
        const { size, accent, blurHash } =
          await this.getOnlineImageSizeAndMeta(src)
        const filename = src.split('/').pop()
        this.logger.debug(
          `[${filename}]: height: ${size.height}, width: ${size.width}, accent: ${accent}`,
        )

        result.push({ ...size, accent, src, blurHash })
      } catch (error) {
        this.logger.error(`GET --> ${src} ${error.message}`)

        const oldRecord = oldImagesMap.get(src)
        if (oldRecord) {
          result.push(oldRecord)
        } else {
          result.push({
            width: undefined,
            height: undefined,
            type: undefined,
            accent: undefined,
            src: undefined,
            blurHash: undefined,
          })
        }
      }
    })

    // Add all tasks to the queue and wait for completion
    const wait = queue.addMultiple(imageProcessingTasks)
    await wait()

    // 老图片不要过滤，记录到列头
    if (originImages) {
      for (const oldImageRecord of originImages) {
        const src = oldImageRecord.src
        if (src && !newImageSrcSet.has(src)) {
          result.unshift(oldImageRecord)
        }
      }
    }

    await onUpdate(result)
  }

  getOnlineImageSizeAndMeta = async (image: string) => {
    const {
      url: { webUrl },
    } = await this.configsService.waitForConfigReady()
    const { data, headers } = await this.httpService.axiosRef.get<any>(image, {
      responseType: 'arraybuffer',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        referer: webUrl,
      },
    })

    const imageType = headers['content-type']!

    const buffer = Buffer.from(data)
    const sharp = await requireDepsWithInstall('sharp')
    const sharped = sharp(buffer) as Sharp
    const metadata = await sharped.metadata()
    const size = {
      height: metadata.height,
      width: metadata.width,
      type: imageType,
    }
    const { dominant } = await sharped.stats()

    // get accent color
    // r g b number to hex
    const accent = `#${dominant.r.toString(16).padStart(2, '0')}${dominant.g.toString(16).padStart(2, '0')}${dominant.b.toString(16).padStart(2, '0')}`

    const blurHash = await encodeImageToBlurhash(sharped)

    return { size, accent, blurHash }
  }
}

const encodeImageToBlurhash = (sharped: Sharp) =>
  new Promise<string>((resolve, reject) => {
    sharped
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer((err, buffer, { width, height }) => {
        if (err) return reject(err)

        resolve(encode(new Uint8ClampedArray(buffer), width, height, 4, 4))
      })
  })
