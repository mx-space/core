import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { Inject, Injectable, Optional } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'

import { FileTypeEnum } from './file.type'
import {
  FILE_STORAGE_ROOT,
  resolveFileStorageRoot,
} from './file-storage.constants'
import type { LocalFileCandidate } from './file-usage.types'

@Injectable()
export class FileReferenceInventoryService {
  private readonly storageRoot: string

  constructor(
    private readonly configsService: ConfigsService,
    @Optional() @Inject(FILE_STORAGE_ROOT) storageRoot?: string,
  ) {
    this.storageRoot = storageRoot ?? resolveFileStorageRoot()
  }

  async listLocalFiles(): Promise<LocalFileCandidate[]> {
    const { serverUrl } = await this.configsService.get('url')
    const baseUrl = serverUrl.replace(/\/+$/u, '')
    const files: LocalFileCandidate[] = []

    for (const type of Object.values(FileTypeEnum)) {
      const root = path.resolve(this.storageRoot, type)
      const names = await this.walk(root)
      for (const name of names) {
        const normalizedName = name.split(path.sep).join('/')
        const encodedName = normalizedName
          .split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/')
        files.push({
          fileName: normalizedName,
          fileUrl: `${baseUrl}/objects/${type}/${encodedName}`,
        })
      }
    }

    return files
  }

  private async walk(root: string, relativePath = ''): Promise<string[]> {
    const directory = path.resolve(root, relativePath)
    let entries: Dirent[]
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return []
      }
      throw error
    }

    const files: string[] = []
    for (const entry of entries) {
      const nextPath = path.join(relativePath, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await this.walk(root, nextPath)))
      } else if (entry.isFile()) {
        files.push(nextPath)
      }
    }
    return files
  }
}
