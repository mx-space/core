import imageSize from 'image-size'

import { Injectable, Logger } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'
import { getAverageRGB, pickImagesFromMarkdown } from '~/utils/pic.util'

import { HttpService } from './helper.http.service'
import type { ImageModel } from '~/shared/model/image.model'

@Injectable()
export class ImageService {
  private logger: Logger
  constructor(
    private readonly httpService: HttpService,
    private readonly configsService: ConfigsService,
  ) {
    this.logger = new Logger(ImageService.name)
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
      (originImages ?? []).map((image) => [image.src, image]),
    )
    const task = [] as Promise<ImageModel>[]
    for (const src of newImages) {
      const originImage = oldImagesMap.get(src)
      const keys = new Set(Object.keys(originImage || {}))

      // 原有图片 和 现有图片 src 一致 跳过
      if (
        originImage &&
        originImage.src === src &&
        ['height', 'width', 'type', 'accent'].every(
          (key) => keys.has(key) && originImage[key],
        )
      ) {
        result.push(originImage)
        continue
      }
      const promise = new Promise<ImageModel>((resolve) => {
        this.logger.log(`Get --> ${src}`)
        this.getOnlineImageSizeAndMeta(src)
          .then(({ size, accent }) => {
            const filename = src.split('/').pop()
            this.logger.debug(
              `[${filename}]: height: ${size.height}, width: ${size.width}, accent: ${accent}`,
            )

            resolve({ ...size, accent, src })
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
    const size = imageSize(buffer)

    // get accent color
    const accent = await getAverageRGB(buffer, imageType)

    return { size, accent }
  }
}
