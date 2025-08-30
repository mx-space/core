/**
 * @file helper.asset.service.ts
 * @author Innei
 * @description 用于获取静态资源的服务
 */
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { join } from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { USER_ASSET_DIR } from '~/constants/path.constant'
import { HttpService } from './helper.http.service'

// 先从 ASSET_DIR 找用户自定义的资源，没有就从默认的 ASSET_DIR 找，没有就从网上拉取，存到默认的 ASSET_DIR
@Injectable()
export class AssetService {
  private logger: Logger
  constructor(private readonly httpService: HttpService) {
    this.logger = new Logger(AssetService.name)
  }

  /**
   * 内置资源地址
   */
  public embedAssetPath = path.resolve(cwd, 'assets')
  // 在线资源的地址 `/` 结尾
  private onlineAssetPath =
    'https://cdn.jsdelivr.net/gh/mx-space/assets@master/'

  private checkRoot() {
    if (!existsSync(this.embedAssetPath)) {
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
    if (!existsSync(path)) {
      return false
    }
    return true
  }

  private async getUserCustomAsset(
    path: string,
    options: Parameters<typeof fs.readFile>[1],
  ) {
    if (existsSync(join(USER_ASSET_DIR, path))) {
      return await fs.readFile(join(USER_ASSET_DIR, path), options)
    }
    return null
  }

  public async getAsset(
    path: string,
    options: Parameters<typeof fs.readFile>[1],
  ) {
    const hasCustom = await this.getUserCustomAsset(path, options)
    // 想找用户自定义的资源入口
    if (hasCustom) {
      return hasCustom
    }
    if (!this.checkAssetPath(path)) {
      try {
        // 去线上拉取
        const { data } = await this.httpService.axiosRef.get<string>(
          this.onlineAssetPath + path,
        )

        await fs.mkdir(
          (() => {
            const p = join(this.embedAssetPath, path).split('/')
            return p.slice(0, -1).join('/')
          })(),
          { recursive: true },
        )
        await fs.writeFile(join(this.embedAssetPath, path), data, options)
        return data
      } catch (error) {
        this.logger.error('本地资源不存在，线上资源无法拉取')
        throw error
      }
    }
    return fs.readFile(join(this.embedAssetPath, path), options)
  }

  public async writeUserCustomAsset(
    path: string,
    data: any,
    options: Parameters<typeof fs.writeFile>[2],
  ) {
    await fs.mkdir(
      (() => {
        const p = join(USER_ASSET_DIR, path).split('/')
        return p.slice(0, -1).join('/')
      })(),
      { recursive: true },
    )
    return fs.writeFile(join(USER_ASSET_DIR, path), data, options)
  }

  public removeUserCustomAsset(path: string) {
    return fs.unlink(join(USER_ASSET_DIR, path))
  }
}
