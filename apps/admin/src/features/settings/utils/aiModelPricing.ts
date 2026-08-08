import type { TranslationKey, TranslationValues } from '~/i18n/types'

import type { AIModelPricing } from '../types/settings'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function formatAIModelPricing(
  pricing: AIModelPricing | undefined,
  t: Translator,
): string | null {
  if (!pricing) return null

  const prompt = parsePrice(pricing.prompt)
  const completion = parsePrice(pricing.completion)
  const image = parsePrice(pricing.image)
  const request = parsePrice(pricing.request)
  const knownPrices = [prompt, completion, image, request].filter(
    (value): value is number => value !== undefined,
  )
  if (knownPrices.length === 0) return null
  if (knownPrices.every((value) => value === 0)) {
    return t('settings.ai.pricing.free')
  }

  const parts: string[] = []
  if (pricing.unit === 'character') {
    const characterPrice = prompt || completion
    if (characterPrice) {
      parts.push(
        t('settings.ai.pricing.charactersPerMillion', {
          price: formatUsd(characterPrice * 1_000_000),
        }),
      )
    }
  } else {
    if (prompt) {
      parts.push(
        t('settings.ai.pricing.inputPerMillion', {
          price: formatUsd(prompt * 1_000_000),
        }),
      )
    }
    if (completion) {
      parts.push(
        t('settings.ai.pricing.outputPerMillion', {
          price: formatUsd(completion * 1_000_000),
        }),
      )
    }
  }
  if (image) {
    parts.push(t('settings.ai.pricing.perImage', { price: formatUsd(image) }))
  }
  if (request) {
    parts.push(
      t('settings.ai.pricing.perRequest', { price: formatUsd(request) }),
    )
  }

  return parts.length > 0 ? parts.join(' · ') : null
}

function parsePrice(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function formatUsd(value: number): string {
  return `$${new Intl.NumberFormat('en-US', {
    maximumSignificantDigits: 6,
    useGrouping: true,
  }).format(value)}`
}
