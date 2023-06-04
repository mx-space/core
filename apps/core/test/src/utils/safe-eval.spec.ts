import { safeEval } from '~/utils/safe-eval.util'

describe('test safe-eval', () => {
  it('should eval', () => {
    const res = safeEval(`return 1 + 2`)
    expect(res).toBe(3)
  })

  it('should eval with ctx', () => {
    const res = safeEval(`return a + b`, { a: 1, b: 2 })
    expect(res).toBe(3)
  })

  it('should can not access to global or process or require', () => {
    expect(safeEval(`return global`)).toStrictEqual({})

    expect(() => {
      safeEval(`return process`)
    }).toThrow()

    expect(() => {
      safeEval(`return require`)
    }).toThrow()
  })

  describe('test escape', () => {
    it('case1', () => {
      expect(() =>
        safeEval(`this.constructor.constructor("return process")().exit()`),
      ).toThrow()
    })
  })

  it('should can access mocked global context', () => {
    const res = safeEval(`return global.a`, { global: { a: 1 } })
    expect(res).toBe(1)
  })
  it('should can access mocked require function', () => {
    const res = safeEval(`return require('fs').readFileSync('/etc/hosts')`, {
      require: (name: string) => {
        if (name === 'fs') {
          return {
            readFileSync: (path: string) => {
              return ''
            },
          }
        }
      },
    })
    expect(res).toBe('')
  })

  it('should handle promise', async () => {
    const promise = safeEval(
      `async function handler() { return 'Hello' }; return handler()`,
    )
    expect(promise.__proto__.constructor.name).toBe('Promise')

    expect(await promise).toBe('Hello')
  })
})
