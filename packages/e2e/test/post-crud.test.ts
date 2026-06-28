import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createE2EBackend, type E2EBackend } from '../src/helpers/e2e-app'
import {
  extractId,
  getItems,
  getPayload,
  parseEnvelope,
  runMxs,
} from '../src/helpers/mxs'
import { seedOwnerAndWriteProfile } from '../src/helpers/seed-auth'
import { makeTmpHome, type TmpHome } from '../src/helpers/tmp-home'

describe('mxs post CRUD against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'post-crud',
      tmpHome: tmpHome.path,
    })
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => backend.backendEnv(tmpHome.path)

  it('creates, lists, gets, updates, and deletes a post', async () => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const categoryName = `E2E ${unique}`
    const category = await runMxs(
      [
        '--json',
        'category',
        'create',
        '--name',
        categoryName,
        '--slug',
        `e2e-${unique}`,
      ],
      env(),
    )
    expect(category.code, category.stderr || category.stdout).toBe(0)

    const created = await runMxs(
      [
        '--json',
        'post',
        'create',
        '--title',
        'hello e2e',
        '--slug',
        'hello-e2e',
        '--category',
        categoryName,
        '--format',
        'markdown',
        '--content',
        'first body',
      ],
      env(),
    )
    expect(created.code, created.stderr || created.stdout).toBe(0)
    const id = extractId(parseEnvelope(created.stdout).data)

    const listed = await runMxs(['--json', 'post', 'list'], env())
    expect(listed.code, listed.stderr || listed.stdout).toBe(0)
    expect(
      getItems(parseEnvelope(listed.stdout).data).map((item) =>
        extractId(item),
      ),
    ).toContain(id)

    const got = await runMxs(['--json', 'post', 'get', id], env())
    expect(got.code, got.stderr || got.stdout).toBe(0)
    expect(getPayload(parseEnvelope(got.stdout).data)).toMatchObject({
      title: 'hello e2e',
    })

    const updated = await runMxs(
      ['--json', 'post', 'update', id, '--title', 'hello revised'],
      env(),
    )
    expect(updated.code, updated.stderr || updated.stdout).toBe(0)

    const revised = await runMxs(['--json', 'post', 'get', id], env())
    expect(revised.code, revised.stderr || revised.stdout).toBe(0)
    expect(getPayload(parseEnvelope(revised.stdout).data)).toMatchObject({
      title: 'hello revised',
    })

    const deleted = await runMxs(
      ['--json', 'post', 'delete', id, '--force'],
      env(),
    )
    expect(deleted.code, deleted.stderr || deleted.stdout).toBe(0)
  }, 90_000)
})
