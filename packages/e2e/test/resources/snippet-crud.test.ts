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

describe('mxs snippet CRUD against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'snippet-crud',
      tmpHome: tmpHome.path,
    })
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => backend.backendEnv(tmpHome.path)

  it('creates, lists, gets, updates, and deletes a text snippet', async () => {
    const name = `e2e-snippet-${Date.now()}`

    const created = await runMxs(
      [
        '--json',
        'snippet',
        'create',
        '--name',
        name,
        '--type',
        'text',
        '--raw',
        'hello e2e snippet',
      ],
      env(),
    )
    expect(created.code, created.stderr || created.stdout).toBe(0)
    const id = extractId(parseEnvelope(created.stdout).data)

    const listed = await runMxs(['--json', 'snippet', 'list'], env())
    expect(listed.code, listed.stderr || listed.stdout).toBe(0)
    expect(
      getItems(parseEnvelope(listed.stdout).data).map((item) =>
        extractId(item),
      ),
    ).toContain(id)

    const got = await runMxs(['--json', 'snippet', 'get', id], env())
    expect(got.code, got.stderr || got.stdout).toBe(0)
    expect(getPayload(parseEnvelope(got.stdout).data)).toMatchObject({
      name,
    })

    const updated = await runMxs(
      ['--json', 'snippet', 'update', id, '--raw', 'updated snippet content'],
      env(),
    )
    expect(updated.code, updated.stderr || updated.stdout).toBe(0)

    const revised = await runMxs(['--json', 'snippet', 'get', id], env())
    expect(revised.code, revised.stderr || revised.stdout).toBe(0)
    expect(getPayload(parseEnvelope(revised.stdout).data)).toMatchObject({
      raw: 'updated snippet content',
    })

    const deleted = await runMxs(
      ['--json', 'snippet', 'delete', id, '--force'],
      env(),
    )
    expect(deleted.code, deleted.stderr || deleted.stdout).toBe(0)
  }, 90_000)
})
