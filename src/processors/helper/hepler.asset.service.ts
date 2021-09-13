/**
 * @file helper.asset.service.ts
 * @author Innei
 * @description 用于获取静态资源的服务
 */
import { Injectable, Logger } from '@nestjs/common'
import fs, { mkdirSync } from 'fs'
import path, { join } from 'path'
import { HttpService } from './helper.http.service'

@Injectable()
export class AssetService {
  private logger: Logger
  constructor(private readonly httpService: HttpService) {
    this.logger = new Logger(AssetService.name)

    if (!this.checkRoot()) {
      this.logger.log('资源目录不存在，创建资源目录')
      mkdirSync(this.assetPath, { recursive: true })
    }
  }

  public assetPath = path.resolve(process.cwd(), 'assets')
  // 在线资源的地址 `/` 结尾
  private onlineAssetPath =
    'https://cdn.jsdelivr.net/gh/mx-space/assets@master/'

  private checkRoot() {
    if (!fs.existsSync(this.assetPath)) {
      return false
    }
    return true
  }

  private checkAssetPath(path: string) {
    if (!this.checkRoot()) {
      return false
    }
    path = join(this.assetPath, path)
    if (!fs.existsSync(path)) {
      return false
    }
    return true
  }

  public async getAsset(
    path: string,
    options: Parameters<typeof fs.readFileSync>[1],
  ) {
    if (!this.checkAssetPath(path)) {
      try {
        // 去线上拉取
        const { data } = await this.httpService.axiosRef.get(
          this.onlineAssetPath + path,
        )

        fs.mkdirSync(
          (() => {
            const p = join(this.assetPath, path).split('/')
            return p.slice(0, p.length - 1).join('/')
          })(),
          { recursive: true },
        )
        fs.writeFileSync(join(this.assetPath, path), data, options)
        return data
      } catch (e) {
        this.logger.error('本地资源不存在，线上资源无法拉取')
        throw e
      }
    }
    return fs.readFileSync(join(this.assetPath, path), options)
  }
}
