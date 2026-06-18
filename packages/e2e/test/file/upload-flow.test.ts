import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createE2EBackend, type E2EBackend } from '../../src/helpers/e2e-app'
import {
  getItems,
  getPayload,
  parseEnvelope,
  runMxs,
} from '../../src/helpers/mxs'
import { seedOwnerAndWriteProfile } from '../../src/helpers/seed-auth'
import {
  cleanStaticFiles,
  staticFilePath,
} from '../../src/helpers/static-file-paths'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

describe('mxs file upload flow against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome
  let sourcePath: string
  let fileName: string
  let renamedName: string

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'file-upload',
      tmpHome: tmpHome.path,
    })
    cleanStaticFiles()
    sourcePath = join(tmpHome.path, 'upload-source.txt')
    writeFileSync(sourcePath, 'e2e upload fixture content')
    const stamp = Date.now()
    fileName = `e2e-upload-${stamp}.txt`
    renamedName = `e2e-renamed-${stamp}.txt`
  }, 120_000)

  afterAll(async () => {
    cleanStaticFiles()
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => ({
    XDG_CONFIG_HOME: tmpHome.path,
    MXS_PROFILE: 'file-upload',
  })

  it('uploads a file and returns url + name', async () => {
    const res = await runMxs(
      [
        '--json',
        'file',
        'upload',
        sourcePath,
        '--type',
        'file',
        '--name',
        fileName,
      ],
      env(),
    )
    expect(res.code, res.stderr).toBe(0)
    const envelope = parseEnvelope(res.stdout)
    expect(envelope.ok).toBe(true)
    const payload = getPayload(envelope.data) as Record<string, unknown>
    expect(typeof payload.url).toBe('string')
    expect(typeof payload.name).toBe('string')
  }, 60_000)

  it('file exists on disk after upload', () => {
    expect(existsSync(staticFilePath('file', fileName))).toBe(true)
  })

  it('list shows the uploaded file', async () => {
    const res = await runMxs(
      ['--json', 'file', 'list', '--type', 'file'],
      env(),
    )
    expect(res.code, res.stderr).toBe(0)
    const envelope = parseEnvelope(res.stdout)
    expect(envelope.ok).toBe(true)
    const names = getItems(envelope.data).map(
      (item) => (item as Record<string, unknown>).name,
    )
    expect(names).toContain(fileName)
  }, 60_000)

  it('rename moves the file on disk', async () => {
    const res = await runMxs(
      [
        '--json',
        'file',
        'rename',
        fileName,
        renamedName,
        '--type',
        'file',
      ],
      env(),
    )
    expect(res.code, res.stderr).toBe(0)
    const envelope = parseEnvelope(res.stdout)
    expect(envelope.ok).toBe(true)
    expect(existsSync(staticFilePath('file', fileName))).toBe(false)
    expect(existsSync(staticFilePath('file', renamedName))).toBe(true)
  }, 60_000)

  it('delete removes the renamed file from disk', async () => {
    const res = await runMxs(
      [
        '--json',
        'file',
        'delete',
        renamedName,
        '--type',
        'file',
        '--force',
      ],
      env(),
    )
    expect(res.code, res.stderr).toBe(0)
    const envelope = parseEnvelope(res.stdout)
    expect(envelope.ok).toBe(true)
    expect(existsSync(staticFilePath('file', renamedName))).toBe(false)
  }, 60_000)
})
