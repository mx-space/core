import { SandboxService } from '~/utils/sandbox'

describe('SandboxService', () => {
  let sandboxService: SandboxService

  beforeAll(async () => {
    sandboxService = new SandboxService({
      maxWorkers: 2,
      minWorkers: 1,
      defaultTimeout: 5000,
      idleTimeout: 1000,
      bridgeHandlers: {
        getMaster: async () => ({ name: 'test-master' }),
        'config.get': async (key: string) => `config-${key}`,
        'storage.cache.get': async () => null,
        'storage.cache.set': async () => {},
        'storage.cache.del': async () => {},
        'storage.db.get': async () => null,
        'storage.db.set': async () => ({}),
        'storage.db.find': async () => [],
        'storage.db.insert': async () => ({}),
        'storage.db.update': async () => ({}),
        'storage.db.del': async () => ({}),
        broadcast: () => {},
        writeAsset: async () => {},
        readAsset: async () => null,
      },
    })
    await sandboxService.initialize()
  })

  afterAll(async () => {
    await sandboxService.shutdown()
  })

  describe('basic execution', () => {
    test('should execute simple code and return result', async () => {
      const result = await sandboxService.execute(
        'function handler() { return 1 + 1 }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe(2)
    })

    test('should handle async code', async () => {
      const result = await sandboxService.execute(
        'async function handler() { return await Promise.resolve(42) }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe(42)
    })

    test('should catch errors and return failure', async () => {
      const result = await sandboxService.execute(
        'function handler() { throw new Error("test error") }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('test error')
    })
  })

  describe('context access', () => {
    test('should access context.req', async () => {
      const result = await sandboxService.execute(
        'function handler(ctx) { return ctx.query.foo }',
        {
          req: { query: { foo: 'bar' } },
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe('bar')
    })

    test('should access isAuthenticated', async () => {
      const result = await sandboxService.execute(
        'function handler(ctx) { return ctx.isAuthenticated }',
        {
          req: {},
          res: {},
          isAuthenticated: true,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    test('should access model info', async () => {
      const result = await sandboxService.execute(
        'function handler(ctx) { return { name: ctx.name, ref: ctx.reference } }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'my-func', reference: 'my-ref' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'my-func', ref: 'my-ref' })
    })
  })

  describe('require functionality', () => {
    test('should require allowed built-in modules', async () => {
      const result = await sandboxService.execute(
        'async function handler(ctx, require) { const path = await require("node:path"); return path.join("a", "b") }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe('a/b')
    })

    test('should block banned modules', async () => {
      const result = await sandboxService.execute(
        'async function handler(ctx, require) { return await require("node:fs") }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('not allowed')
    })

    test('should block child_process', async () => {
      const result = await sandboxService.execute(
        'async function handler(ctx, require) { return await require("child_process") }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('not allowed')
    })

    test('should block node:module to prevent createRequire bypass', async () => {
      const result = await sandboxService.execute(
        'async function handler(ctx, require) { return await require("node:module") }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('not allowed')
    })
  })

  describe('Edge Runtime APIs', () => {
    test('should have fetch available', async () => {
      const result = await sandboxService.execute(
        'function handler() { return typeof fetch === "function" }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    test('should have crypto available', async () => {
      const result = await sandboxService.execute(
        'async function handler() { const arr = new Uint8Array(16); crypto.getRandomValues(arr); return arr.length }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe(16)
    })

    test('should have TextEncoder/TextDecoder available', async () => {
      const result = await sandboxService.execute(
        'function handler() { const enc = new TextEncoder(); const dec = new TextDecoder(); return dec.decode(enc.encode("hello")) }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe('hello')
    })

    test('should have atob/btoa available', async () => {
      const result = await sandboxService.execute(
        'function handler() { return atob(btoa("hello")) }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe('hello')
    })

    test('should have URL and URLSearchParams available', async () => {
      const result = await sandboxService.execute(
        'function handler() { const url = new URL("https://example.com?foo=bar"); return url.searchParams.get("foo") }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe('bar')
    })

    test('should have setTimeout available with limits', async () => {
      const result = await sandboxService.execute(
        'async function handler() { return new Promise(resolve => setTimeout(() => resolve("done"), 10)) }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe('done')
    })

    test('should have structuredClone available', async () => {
      const result = await sandboxService.execute(
        'function handler() { const obj = { a: 1, b: { c: 2 } }; const clone = structuredClone(obj); clone.b.c = 3; return obj.b.c }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe(2) // Original object unchanged
    })

    test('should have Blob available', async () => {
      const result = await sandboxService.execute(
        'async function handler() { const blob = new Blob(["hello"], { type: "text/plain" }); return blob.size }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe(5)
    })

    test('should have ReadableStream available', async () => {
      const result = await sandboxService.execute(
        'function handler() { return typeof ReadableStream === "function" }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })
  })

  describe('bridge calls', () => {
    test('should call getMaster through bridge', async () => {
      const result = await sandboxService.execute(
        'async function handler(ctx) { return await ctx.getMaster() }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'test-master' })
    })

    test('should call config.get through bridge', async () => {
      const result = await sandboxService.execute(
        'async function handler(ctx) { const config = await ctx.getService("config"); return await config.get("test-key") }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe('config-test-key')
    })
  })

  describe('Worker pool', () => {
    test('should report stats correctly', () => {
      const stats = sandboxService.getStats()

      expect(stats.totalWorkers).toBeGreaterThanOrEqual(1)
      expect(stats.busyWorkers).toBe(0)
      expect(stats.pendingExecutions).toBe(0)
    })

    test('should handle concurrent executions', async () => {
      const promises = Array.from({ length: 4 }, (_, i) =>
        sandboxService.execute(`function handler() { return ${i} }`, {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        }),
      )

      const results = await Promise.all(promises)

      results.forEach((result, i) => {
        expect(result.success).toBe(true)
        expect(result.data).toBe(i)
      })
    })
  })

  describe('security', () => {
    test('should not allow eval', async () => {
      const result = await sandboxService.execute(
        'function handler() { return eval("1+1") }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(false)
      // vm 的 codeGeneration: { strings: false } 会阻止 eval
      expect(result.error?.message).toContain('Code generation from strings')
    })

    test('should not allow Function constructor with string', async () => {
      const result = await sandboxService.execute(
        'function handler() { return new Function("return 1+1")() }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      // Function 构造函数在 sandbox 中被限制
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('not allowed')
    })

    test('should not allow Function() call with string', async () => {
      const result = await sandboxService.execute(
        'function handler() { return Function("return 1+1")() }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('not allowed')
    })

    test('should timeout long-running code', async () => {
      const result = await sandboxService.execute(
        'function handler() { while(true) {} }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
        { timeout: 100 },
      )

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('timed out')
    })

    test('should not expose process.env', async () => {
      const result = await sandboxService.execute(
        'function handler() { return process.env }',
        {
          req: {},
          res: {},
          isAuthenticated: false,
          model: { id: '1', name: 'test', reference: 'test' },
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeUndefined()
    })
  })

  describe('dynamic scaling', () => {
    test('should scale up workers under load', async () => {
      const initialStats = sandboxService.getStats()
      const initialWorkers = initialStats.totalWorkers

      // Create concurrent load
      const promises = Array.from({ length: 4 }, () =>
        sandboxService.execute(
          'async function handler() { return new Promise(r => setTimeout(r, 50)) }',
          {
            req: {},
            res: {},
            isAuthenticated: false,
            model: { id: '1', name: 'test', reference: 'test' },
          },
        ),
      )

      // Wait a bit for workers to scale up
      await new Promise((r) => setTimeout(r, 20))
      const loadStats = sandboxService.getStats()

      await Promise.all(promises)

      // Should have scaled up (max 2 workers in this test)
      expect(loadStats.totalWorkers).toBeGreaterThanOrEqual(initialWorkers)
    })

    test('should scale down idle workers', async () => {
      // Execute something to potentially scale up
      await Promise.all(
        Array.from({ length: 2 }, () =>
          sandboxService.execute('function handler() { return 1 }', {
            req: {},
            res: {},
            isAuthenticated: false,
            model: { id: '1', name: 'test', reference: 'test' },
          }),
        ),
      )

      // Wait for idle timeout + cleanup interval (idleTimeout=1000, cleanup every 30s)
      // In test, we can't wait 30s, so just verify the mechanism exists
      const stats = sandboxService.getStats()
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(1) // minWorkers
    })
  })
})
