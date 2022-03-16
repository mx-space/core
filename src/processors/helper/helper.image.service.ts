import { Injectable, Logger } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import imageSize from 'image-size'
import { HttpService } from './helper.http.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { TextImageRecordType, WriteBaseModel } from '~/shared/model/base.model'
import { getAverageRGB, pickImagesFromMarkdown } from '~/utils/pic.util'

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
    _model: MongooseModel<T>,
    id: string,
  ) {
    const model = _model as any as ReturnModelType<typeof WriteBaseModel>
    const document = await model.findById(id).lean()
    const { text } = document
    const newImages = pickImagesFromMarkdown(text)

    const result = [] as TextImageRecordType[]

    const oldImages = document.images || []
    const oldImagesMap = new Map(oldImages.map((image) => [image.src, image]))
    const task = [] as Promise<TextImageRecordType>[]
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
      const promise = new Promise<TextImageRecordType>((resolve) => {
        this.logger.log(`Get --> ${src}`)
        this.getOnlineImageSizeAndMeta(src)
          .then(({ size, accent }) => {
            const filename = src.split('/').pop()
            this.logger.debug(
              `[${filename}]: height: ${size.height}, width: ${size.width}, accent: ${accent}`,
            )

            resolve({ ...size, accent, src })
          })
          .catch((e) => {
            this.logger.error(`GET --> ${src} ${e.message}`)

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

    await model.updateOne(
      { _id: id },
      // 过滤多余的
      { images: result.filter(({ src }) => newImages.includes(src)) },
    )
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

    const imageType = headers['content-type']

    const buffer = Buffer.from(data)
    const size = imageSize(buffer)

    // get accent color
    const accent = await getAverageRGB(buffer, imageType)

    return { size, accent }
  }
}
