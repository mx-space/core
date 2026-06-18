import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createE2EBackend, type E2EBackend } from '../../src/helpers/e2e-app'
import {
  extractId,
  getItems,
  getPayload,
  parseEnvelope,
  runMxs,
} from '../../src/helpers/mxs'
import { seedOwnerAndWriteProfile } from '../../src/helpers/seed-auth'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

describe('mxs page CRUD against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'page-crud',
      tmpHome: tmpHome.path,
    })
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => ({
    XDG_CONFIG_HOME: tmpHome.path,
    MXS_PROFILE: 'page-crud',
  })

  it('creates, lists, gets, updates, and deletes a page', async () => {
    const slug = `e2e-page-${Date.now()}`

    const created = await runMxs(
      [
        '--json',
        'page',
        'create',
        '--title',
        'e2e page title',
        '--slug',
        slug,
        '--content',
        'e2e page body',
        '--format',
        'markdown',
      ],
      env(),
    )
    expect(created.code, created.stderr || created.stdout).toBe(0)
    const id = extractId(parseEnvelope(created.stdout).data)

    const listed = await runMxs(['--json', 'page', 'list'], env())
    expect(listed.code, listed.stderr || listed.stdout).toBe(0)
    expect(
      getItems(parseEnvelope(listed.stdout).data).map((item) =>
        extractId(item),
      ),
    ).toContain(id)

    const got = await runMxs(['--json', 'page', 'get', id], env())
    expect(got.code, got.stderr || got.stdout).toBe(0)
    expect(getPayload(parseEnvelope(got.stdout).data)).toMatchObject({
      title: 'e2e page title',
    })

    const updated = await runMxs(
      ['--json', 'page', 'update', id, '--title', 'e2e page revised'],
      env(),
    )
    expect(updated.code, updated.stderr || updated.stdout).toBe(0)

    const revised = await runMxs(['--json', 'page', 'get', id], env())
    expect(revised.code, revised.stderr || revised.stdout).toBe(0)
    expect(getPayload(parseEnvelope(revised.stdout).data)).toMatchObject({
      title: 'e2e page revised',
    })

    const deleted = await runMxs(
      ['--json', 'page', 'delete', id, '--force'],
      env(),
    )
    expect(deleted.code, deleted.stderr || deleted.stdout).toBe(0)
  }, 90_000)
})
