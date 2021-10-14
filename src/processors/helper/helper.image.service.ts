import { Injectable, Logger } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { AnyParamConstructor } from '@typegoose/typegoose/lib/types'
import imageSize from 'image-size'
import { ConfigsService } from '~/modules/configs/configs.service'
import { TextImageRecordType, WriteBaseModel } from '~/shared/model/base.model'
import { getAverageRGB, pickImagesFromMarkdown } from '~/utils/pic.util'
import { HttpService } from './helper.http.service'

@Injectable()
export class ImageService {
  private logger: Logger
  constructor(
    private readonly httpService: HttpService,
    private readonly configsService: ConfigsService,
  ) {
    this.logger = new Logger(ImageService.name)
  }

  async recordImageDimensions<T extends WriteBaseModel>(
    model: ReturnModelType<AnyParamConstructor<T>>,
    id: string,
  ) {
    const document = await model.findById(id).lean()
    const { text } = document
    const originImages: TextImageRecordType[] = document.images || []
    const images = pickImagesFromMarkdown(text)
    const result = [] as TextImageRecordType[]

    const { images: oldImages } = await model.findById(id).lean()
    const oldImagesMap = new Map(oldImages?.map((image) => [image.src, image]))

    // eslint-disable-next-line prefer-const
    for await (let [i, src] of images.entries()) {
      const keys = new Set(Object.keys(originImages[i] || {}))
      if (
        originImages[i] &&
        originImages[i].src === src &&
        ['height', 'width', 'type', 'accent'].every(
          (key) => keys.has(key) && originImages[i][key],
        )
      ) {
        result.push(originImages[i])
        continue
      }
      try {
        this.logger.log('Get --> ' + src)
        const { size, accent } = await this.getOnlineImageSizeAndMeta(src)
        const filename = src.split('/').pop()
        this.logger.debug(
          `[${filename}]: height: ${size.height}, width: ${size.width}, accent: ${accent}`,
        )

        result.push({ ...size, accent, src: src })
      } catch (e) {
        this.logger.error(`GET --> ${src} ${e.message}`)

        const oldRecord = oldImagesMap.get(src)
        if (oldRecord) {
          result.push(oldRecord)
        } else
          result.push({
            width: undefined,
            height: undefined,
            type: undefined,
            accent: undefined,
            src,
          })
      }
    }

    await model.updateOne(
      { _id: id as any },
      // @ts-expect-error
      { $set: { images: result } },
    )
  }

  getOnlineImageSizeAndMeta = async (image: string) => {
    const {
      url: { webUrl },
    } = await this.configsService.waitForConfigReady()
    const { data } = await this.httpService.axiosRef.get<any>(image, {
      responseType: 'arraybuffer',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        referer: webUrl,
      },
    })

    const buffer = Buffer.from(data)
    const size = imageSize(buffer)

    // get accent color
    const accent = await getAverageRGB(buffer)

    return { size, accent }
  }
}
