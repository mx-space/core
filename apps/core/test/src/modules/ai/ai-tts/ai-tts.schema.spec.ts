import { describe, expect, it } from 'vitest'

import { CreateTtsTaskSchema } from '~/modules/ai/ai-tts/ai-tts.schema'

describe('CreateTtsTaskSchema', () => {
  it('accepts a request without langs', () => {
    expect(CreateTtsTaskSchema.safeParse({ refId: '1' }).success).toBe(true)
  })

  it('accepts resolvable language codes, including aliases', () => {
    const result = CreateTtsTaskSchema.safeParse({
      refId: '1',
      langs: ['zh-CN', 'en', 'jp'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a langs array longer than 8', () => {
    const result = CreateTtsTaskSchema.safeParse({
      refId: '1',
      langs: ['en', 'fr', 'de', 'es', 'it', 'ja', 'ko', 'ru', 'pt'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an entry parseLanguageCode cannot resolve', () => {
    const result = CreateTtsTaskSchema.safeParse({
      refId: '1',
      langs: ['zh', 'z'],
    })
    expect(result.success).toBe(false)
  })
})
