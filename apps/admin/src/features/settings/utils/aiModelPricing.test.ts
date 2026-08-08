import { describe, expect, it } from 'vitest'

import type { TranslationKey, TranslationValues } from '~/i18n/types'

import { formatAIModelPricing } from './aiModelPricing'

const templates: Partial<Record<TranslationKey, string>> = {
  'settings.ai.pricing.charactersPerMillion': '{price} / 1M chars',
  'settings.ai.pricing.free': 'Free',
  'settings.ai.pricing.inputPerMillion': 'Input {price} / 1M',
  'settings.ai.pricing.outputPerMillion': 'Output {price} / 1M',
}

function t(key: TranslationKey, values?: TranslationValues) {
  let result = templates[key] ?? key
  for (const [name, value] of Object.entries(values ?? {})) {
    result = result.replaceAll(`{${name}}`, String(value))
  }
  return result
}

describe('formatAIModelPricing', () => {
  it('formats speech input pricing as the character price', () => {
    expect(
      formatAIModelPricing(
        { completion: '0', prompt: '0.000015', unit: 'character' },
        t,
      ),
    ).toBe('$15 / 1M chars')
  })

  it('formats text input and output pricing independently', () => {
    expect(
      formatAIModelPricing(
        { completion: '0.000006', prompt: '0.000002', unit: 'token' },
        t,
      ),
    ).toBe('Input $2 / 1M · Output $6 / 1M')
  })

  it('omits unavailable pricing and labels an explicitly free model', () => {
    expect(formatAIModelPricing(undefined, t)).toBeNull()
    expect(
      formatAIModelPricing({ completion: '0', prompt: '0', unit: 'token' }, t),
    ).toBe('Free')
  })
})
