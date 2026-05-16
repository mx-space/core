/**
 * @file helper.asset.service.ts
 * @author Innei
 * @description 静态资源服务。用户覆写 (FS) 优先于内置 (虚拟) bundle。
 */
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path, { dirname } from 'node:path'

import { Injectable, Logger } from '@nestjs/common'

import { USER_ASSET_DIR } from '~/constants/path.constant'
import { EMBED_FILES } from '~/embed'

function stripLeadingSlash(p: string) {
  return p.replace(/^\/+/, '')
}

export function resolveAssetPath(root: string, assetPath: string) {
  const resolvedRoot = path.resolve(root)
  const resolvedPath = path.resolve(resolvedRoot, assetPath)
  const relativePath = path.relative(resolvedRoot, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Asset path escapes root: ${assetPath}`)
  }

  return resolvedPath
}

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name)

  /**
   * Read an asset: user override on disk → bundled embed → throw.
   */
  public async getAsset(
    assetPath: string,
    options?: Parameters<typeof fs.readFile>[1],
  ): Promise<string | Buffer> {
    const relPath = stripLeadingSlash(assetPath)

    // 1. user override
    const userPath = resolveAssetPath(USER_ASSET_DIR, relPath)
    if (existsSync(userPath)) {
      return await fs.readFile(userPath, options)
    }

    // 2. bundled embed (keys always start with '/')
    const text = EMBED_FILES[`/${relPath}`]
    if (text !== undefined) {
      const encoding =
        typeof options === 'string' ? options : (options?.encoding ?? null)
      return encoding ? text : Buffer.from(text, 'utf8')
    }

    throw new Error(`Asset not found: ${assetPath}`)
  }

  public async writeUserCustomAsset(
    assetPath: string,
    data: any,
    options: Parameters<typeof fs.writeFile>[2],
  ) {
    const targetPath = resolveAssetPath(
      USER_ASSET_DIR,
      stripLeadingSlash(assetPath),
    )
    await fs.mkdir(dirname(targetPath), { recursive: true })
    return fs.writeFile(targetPath, data, options)
  }

  public removeUserCustomAsset(assetPath: string) {
    return fs.unlink(
      resolveAssetPath(USER_ASSET_DIR, stripLeadingSlash(assetPath)),
    )
  }
}
