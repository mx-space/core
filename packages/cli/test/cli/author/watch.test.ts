import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { watchAuthorFile } from '../../../src/cli/author/watch'

const nextText = (file: string, timeoutMs = 2000) =>
  new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      watcher.close()
      reject(new Error('no change observed'))
    }, timeoutMs)
    const watcher = watchAuthorFile(file, (text) => {
      clearTimeout(timer)
      watcher.close()
      resolve(text)
    })
  })

describe('watchAuthorFile', () => {
  it('emits the file text once after an external write', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mxs-author-'))
    const file = path.join(dir, 'a.xml')
    writeFileSync(file, '<p>one</p>')
    const pending = nextText(file)
    await new Promise((r) => setTimeout(r, 50))
    writeFileSync(file, '<p>two</p>')
    await expect(pending).resolves.toBe('<p>two</p>')
  })
})
