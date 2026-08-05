import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FileReferenceInventoryService } from '~/modules/file/file-reference-inventory.service'

describe('FileReferenceInventoryService', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'mx-file-inventory-'))
  })

  afterEach(async () => {
    await rm(root, { force: true, recursive: true })
  })

  it('walks real nested files and URL-encodes each path segment', async () => {
    const nested = path.join(root, 'file', '归档 folder')
    await mkdir(nested, { recursive: true })
    await writeFile(path.join(nested, '资料 100%#.zip'), 'fixture')
    const configs = {
      get: vi.fn().mockResolvedValue({
        serverUrl: 'https://api.example.com/',
      }),
    }
    const inventory = new FileReferenceInventoryService(configs as never, root)

    await expect(inventory.listLocalFiles()).resolves.toEqual([
      {
        fileName: '归档 folder/资料 100%#.zip',
        fileUrl:
          'https://api.example.com/objects/file/%E5%BD%92%E6%A1%A3%20folder/%E8%B5%84%E6%96%99%20100%25%23.zip',
      },
    ])
  })
})
