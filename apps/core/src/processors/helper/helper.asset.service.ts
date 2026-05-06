/**
 * @file helper.asset.service.ts
 * @author Innei
 * @description 用于获取静态资源的服务
 */
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { dirname } from 'node:path'

import { Injectable, Logger } from '@nestjs/common'

import { USER_ASSET_DIR } from '~/constants/path.constant'

import { HttpService } from './helper.http.service'

export function resolveAssetPath(root: string, assetPath: string) {
  const resolvedRoot = path.resolve(root)
  const resolvedPath = path.resolve(resolvedRoot, assetPath)
  const relativePath = path.relative(resolvedRoot, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Asset path escapes root: ${assetPath}`)
  }

  return resolvedPath
}

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
    return existsSync(this.embedAssetPath)
  }

  /**
   * 找默认资源
   * @param assetPath 资源路径
   */
  private checkAssetPath(assetPath: string) {
    return (
      this.checkRoot() &&
      existsSync(resolveAssetPath(this.embedAssetPath, assetPath))
    )
  }

  private async getUserCustomAsset(
    assetPath: string,
    options: Parameters<typeof fs.readFile>[1],
  ) {
    const targetPath = resolveAssetPath(USER_ASSET_DIR, assetPath)
    if (existsSync(targetPath)) {
      return await fs.readFile(targetPath, options)
    }
    return null
  }

  public async getAsset(
    assetPath: string,
    options: Parameters<typeof fs.readFile>[1],
  ) {
    const hasCustom = await this.getUserCustomAsset(assetPath, options)
    // 想找用户自定义的资源入口
    if (hasCustom) {
      return hasCustom
    }
    const targetPath = resolveAssetPath(this.embedAssetPath, assetPath)
    if (!this.checkAssetPath(assetPath)) {
      try {
        // 去线上拉取
        const { data } = await this.httpService.axiosRef.get<string>(
          this.onlineAssetPath + assetPath,
        )

        await fs.mkdir(dirname(targetPath), { recursive: true })
        await fs.writeFile(targetPath, data, options)
        return data
      } catch (error) {
        this.logger.error('本地资源不存在，线上资源无法拉取')
        throw error
      }
    }
    return fs.readFile(targetPath, options)
  }

  public async writeUserCustomAsset(
    assetPath: string,
    data: any,
    options: Parameters<typeof fs.writeFile>[2],
  ) {
    const targetPath = resolveAssetPath(USER_ASSET_DIR, assetPath)
    await fs.mkdir(dirname(targetPath), { recursive: true })
    return fs.writeFile(targetPath, data, options)
  }

  public removeUserCustomAsset(assetPath: string) {
    return fs.unlink(resolveAssetPath(USER_ASSET_DIR, assetPath))
  }
}
