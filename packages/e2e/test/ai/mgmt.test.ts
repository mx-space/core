import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createE2EBackend, type E2EBackend } from '../../src/helpers/e2e-app'
import {
  extractId,
  getItems,
  getPayload,
  parseEnvelope,
  runMxs,
} from '../../src/helpers/mxs'
import { seedAiFixture, type AiFixture } from '../../src/helpers/seed-ai-artifact'
import { seedOwnerAndWriteProfile } from '../../src/helpers/seed-auth'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

describe('mxs ai management against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome
  let fixture: AiFixture

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'ai-mgmt',
      tmpHome: tmpHome.path,
    })
    fixture = await seedAiFixture(backend)
  }, 120_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => ({
    XDG_CONFIG_HOME: tmpHome.path,
    MXS_PROFILE: 'ai-mgmt',
  })

  describe('summary', () => {
    it('list includes seeded summary', async () => {
      const res = await runMxs(['--json', 'ai', 'summary', 'list'], env())
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      expect(getItems(envelope.data).map(extractId)).toContain(fixture.summaryId)
    }, 60_000)

    it('get returns seeded summary content', async () => {
      const res = await runMxs(
        ['--json', 'ai', 'summary', 'get', fixture.summaryId],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      const payload = getPayload(envelope.data) as Record<string, unknown>
      expect(typeof payload.summary === 'string' || typeof (payload as any).summary === 'string').toBe(true)
    }, 60_000)

    it('by-article returns summary for post', async () => {
      const res = await runMxs(
        [
          '--json',
          'ai',
          'summary',
          'by-article',
          fixture.postSlug,
          '--only-db',
        ],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
    }, 60_000)

    it('delete removes the summary', async () => {
      const res = await runMxs(
        ['--json', 'ai', 'summary', 'delete', fixture.summaryId, '--force'],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      const payload = getPayload(envelope.data) as Record<string, unknown>
      expect(payload.deleted).toBe(fixture.summaryId)
    }, 60_000)
  })

  describe('translate', () => {
    it('list includes seeded translation', async () => {
      const res = await runMxs(['--json', 'ai', 'translate', 'list'], env())
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      const ids = getItems(envelope.data).map(extractId)
      expect(ids).toContain(fixture.translationId)
    }, 60_000)

    it('get returns seeded translation', async () => {
      const res = await runMxs(
        ['--json', 'ai', 'translate', 'get', fixture.translationId],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
    }, 60_000)

    it('by-article returns translations for post', async () => {
      const res = await runMxs(
        ['--json', 'ai', 'translate', 'by-article', fixture.postSlug],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
    }, 60_000)

    it('languages returns available langs for post', async () => {
      const res = await runMxs(
        ['--json', 'ai', 'translate', 'languages', fixture.postSlug],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
    }, 60_000)

    it('delete removes the translation', async () => {
      const res = await runMxs(
        [
          '--json',
          'ai',
          'translate',
          'delete',
          fixture.translationId,
          '--force',
        ],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      const payload = getPayload(envelope.data) as Record<string, unknown>
      expect(payload.deleted).toBe(fixture.translationId)
    }, 60_000)
  })

  describe('translate entries', () => {
    it('list includes seeded translation entry', async () => {
      const res = await runMxs(
        ['--json', 'ai', 'translate', 'entries', 'list'],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      const ids = getItems(envelope.data).map(extractId)
      expect(ids).toContain(fixture.translationEntryId)
    }, 60_000)

    it('delete removes the translation entry', async () => {
      const res = await runMxs(
        [
          '--json',
          'ai',
          'translate',
          'entries',
          'delete',
          fixture.translationEntryId,
          '--force',
        ],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      const payload = getPayload(envelope.data) as Record<string, unknown>
      expect(payload.deleted).toBe(fixture.translationEntryId)
    }, 60_000)
  })

  describe('insights', () => {
    it('list includes seeded insights', async () => {
      const res = await runMxs(['--json', 'ai', 'insights', 'list'], env())
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      const ids = getItems(envelope.data).map(extractId)
      expect(ids).toContain(fixture.insightId)
    }, 60_000)

    it('get returns seeded insights', async () => {
      const res = await runMxs(
        ['--json', 'ai', 'insights', 'get', fixture.insightId],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
    }, 60_000)

    it('by-article returns insights for post', async () => {
      const res = await runMxs(
        [
          '--json',
          'ai',
          'insights',
          'by-article',
          fixture.postSlug,
          '--only-db',
        ],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
    }, 60_000)

    it('delete removes the insights record', async () => {
      const res = await runMxs(
        [
          '--json',
          'ai',
          'insights',
          'delete',
          fixture.insightId,
          '--force',
        ],
        env(),
      )
      expect(res.code, res.stderr).toBe(0)
      const envelope = parseEnvelope(res.stdout)
      expect(envelope.ok).toBe(true)
      const payload = getPayload(envelope.data) as Record<string, unknown>
      expect(payload.deleted).toBe(fixture.insightId)
    }, 60_000)
  })
})
