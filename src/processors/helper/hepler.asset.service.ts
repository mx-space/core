/**
 * @file helper.asset.service.ts
 * @author Innei
 * @description 用于获取静态资源的服务
 */
import { Injectable, Logger } from '@nestjs/common'
import fs from 'fs'
import path, { join } from 'path'
import { ASSET_DIR } from '~/constants/path.constant'
import { HttpService } from './helper.http.service'

// 先从 ASSET_DIR 找用户自定义的资源, 没有就从默认的 ASSET_DIR 找, 没有就从网上拉取, 存到默认的 ASSET_DIR
@Injectable()
export class AssetService {
  private logger: Logger
  constructor(private readonly httpService: HttpService) {
    this.logger = new Logger(AssetService.name)
  }

  public embedAssetPath = path.resolve(process.cwd(), 'assets')
  // 在线资源的地址 `/` 结尾
  private onlineAssetPath =
    'https://cdn.jsdelivr.net/gh/mx-space/assets@master/'

  private checkRoot() {
    if (!fs.existsSync(this.embedAssetPath)) {
      return false
    }
    return true
  }

  /**
   * 找默认资源
   * @param path 资源路径
   * @returns
   */
  private checkAssetPath(path: string) {
    if (!this.checkRoot()) {
      return false
    }
    path = join(this.embedAssetPath, path)
    if (!fs.existsSync(path)) {
      return false
    }
    return true
  }

  private async getUserCustomAsset(
    path: string,
    options: Parameters<typeof fs.readFileSync>[1],
  ) {
    if (fs.existsSync(join(ASSET_DIR, path))) {
      return fs.readFileSync(join(ASSET_DIR, path), options)
    }
    return null
  }

  public async getAsset(
    path: string,
    options: Parameters<typeof fs.readFileSync>[1],
  ) {
    // 想找用户自定义的资源入口
    if (await this.getUserCustomAsset(path, options)) {
      return this.getUserCustomAsset(path, options)
    }
    if (!this.checkAssetPath(path)) {
      try {
        // 去线上拉取
        const { data } = await this.httpService.axiosRef.get(
          this.onlineAssetPath + path,
        )

        fs.mkdirSync(
          (() => {
            const p = join(this.embedAssetPath, path).split('/')
            return p.slice(0, p.length - 1).join('/')
          })(),
          { recursive: true },
        )
        fs.writeFileSync(join(this.embedAssetPath, path), data, options)
        return data
      } catch (e) {
        this.logger.error('本地资源不存在，线上资源无法拉取')
        throw e
      }
    }
    return fs.readFileSync(join(this.embedAssetPath, path), options)
  }

  public writeAsset(
    path: string,
    data: any,
    options: Parameters<typeof fs.writeFileSync>[2],
  ) {
    fs.mkdirSync(
      (() => {
        const p = join(ASSET_DIR, path).split('/')
        return p.slice(0, p.length - 1).join('/')
      })(),
      { recursive: true },
    )
    fs.writeFileSync(join(ASSET_DIR, path), data, options)
  }
}
