import { encode } from 'blurhash'
import type { ImageModel } from '~/shared/model/image.model'
import type { Sharp } from 'sharp'

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'
import { pickImagesFromMarkdown } from '~/utils/pic.util'
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

    const task = [] as Promise<ImageModel>[]
    for (const src of newImages) {
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
        continue
      }
      const promise = new Promise<ImageModel>((resolve) => {
        this.logger.log(`Get --> ${src}`)
        this.getOnlineImageSizeAndMeta(src)
          .then(({ size, accent, blurHash }) => {
            const filename = src.split('/').pop()
            this.logger.debug(
              `[${filename}]: height: ${size.height}, width: ${size.width}, accent: ${accent}`,
            )

            resolve({ ...size, accent, src, blurHash })
          })
          .catch((error) => {
            this.logger.error(`GET --> ${src} ${error.message}`)

            const oldRecord = oldImagesMap.get(src)
            if (oldRecord) {
              resolve(oldRecord)
            } else
              resolve({
                width: undefined,
                height: undefined,
                type: undefined,
                accent: undefined,
                src: undefined,
                blurHash: undefined,
              })
          })
      })

      task.push(promise)
    }
    const images = await Promise.all(task)
    result.push(...images)

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
