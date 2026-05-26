import { describe, expect, it } from 'vitest'

import { BrowserFetchService } from '~/modules/enrichment/providers/open-graph/browser-fetch.service'
import { AgentBrowserSessionPool as BrowserSessionPool } from '~/processors/agent-browser/agent-browser-pool.service'

const LIVE = process.env.LIVE_BROWSER_FETCH === '1'
const describeLive = LIVE ? describe : describe.skip

describeLive('BrowserFetchService (live agent-browser)', () => {
  it('fetches HTML via real agent-browser CLI', async () => {
    const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 0 })
    const svc = new BrowserFetchService(pool)
    try {
      const res = await svc.fetchHtml('https://example.com/', {
        timeoutMs: 60_000,
        maxBodyBytes: 1_048_576,
      })
      expect(res.contentType).toBe('text/html')
      expect(res.body.length).toBeGreaterThan(100)
      expect(res.body.toLowerCase()).toContain('example domain')
      expect(res.finalUrl).toContain('example.com')
    } finally {
      await pool.shutdown()
    }
  }, 120_000)

  it('fetches HTML + screenshot from a real site', async () => {
    const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 0 })
    const svc = new BrowserFetchService(pool)
    try {
      const res = await svc.fetchPage('https://example.com/', {
        timeoutMs: 60_000,
        maxBodyBytes: 1_048_576,
      })
      expect(res.html.body.toLowerCase()).toContain('example')
      expect(res.screenshotBytes).toBeDefined()
      expect(res.screenshotBytes!.length).toBeGreaterThan(1000)
      expect(res.screenshotBytes![0]).toBe(0xff)
      expect(res.screenshotBytes![1]).toBe(0xd8)
      expect(res.screenshotBytes![2]).toBe(0xff)
    } finally {
      await pool.shutdown()
    }
  }, 120_000)

  it('reuses pooled session across two sequential fetches', async () => {
    const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 30_000 })
    const svc = new BrowserFetchService(pool)
    try {
      const t1 = Date.now()
      const r1 = await svc.fetchHtml('https://example.com/', {
        timeoutMs: 60_000,
        maxBodyBytes: 1_048_576,
      })
      const d1 = Date.now() - t1

      const t2 = Date.now()
      const r2 = await svc.fetchHtml('https://example.org/', {
        timeoutMs: 60_000,
        maxBodyBytes: 1_048_576,
      })
      const d2 = Date.now() - t2

      expect(r1.body.length).toBeGreaterThan(0)
      expect(r2.body.length).toBeGreaterThan(0)
      console.log(`first fetch ${d1}ms; reused-session fetch ${d2}ms`)
    } finally {
      await pool.shutdown()
    }
  }, 180_000)
})
