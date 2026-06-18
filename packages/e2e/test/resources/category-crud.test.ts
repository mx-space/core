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

describe('mxs category CRUD against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'category-crud',
      tmpHome: tmpHome.path,
    })
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => ({
    XDG_CONFIG_HOME: tmpHome.path,
    MXS_PROFILE: 'category-crud',
  })

  it('creates, lists, gets, updates, and deletes a category', async () => {
    const slug = `e2e-cat-${Date.now()}`
    const name = `E2E Category ${Date.now()}`

    const created = await runMxs(
      ['--json', 'category', 'create', '--name', name, '--slug', slug],
      env(),
    )
    expect(created.code, created.stderr || created.stdout).toBe(0)
    const id = extractId(parseEnvelope(created.stdout).data)

    const listed = await runMxs(['--json', 'category', 'list'], env())
    expect(listed.code, listed.stderr || listed.stdout).toBe(0)
    expect(
      getItems(parseEnvelope(listed.stdout).data).map((item) =>
        extractId(item),
      ),
    ).toContain(id)

    const got = await runMxs(['--json', 'category', 'get', id], env())
    expect(got.code, got.stderr || got.stdout).toBe(0)
    expect(getPayload(parseEnvelope(got.stdout).data)).toMatchObject({
      name,
    })

    const updatedName = `E2E Category Revised ${Date.now()}`
    const updated = await runMxs(
      ['--json', 'category', 'update', id, '--name', updatedName],
      env(),
    )
    expect(updated.code, updated.stderr || updated.stdout).toBe(0)

    const revised = await runMxs(['--json', 'category', 'get', id], env())
    expect(revised.code, revised.stderr || revised.stdout).toBe(0)
    expect(getPayload(parseEnvelope(revised.stdout).data)).toMatchObject({
      name: updatedName,
    })

    const deleted = await runMxs(
      ['--json', 'category', 'delete', id, '--force'],
      env(),
    )
    expect(deleted.code, deleted.stderr || deleted.stdout).toBe(0)
  }, 90_000)
})
