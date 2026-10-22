import { afterEach, describe, expect, it } from 'vitest'

import {
  applyModelPlan,
  deriveServiceUrls,
  readOnboardingProgress,
  writeOnboardingProgress,
} from './onboarding'

describe('deriveServiceUrls', () => {
  it('derives server, admin and ws urls from the api and admin locations', () => {
    expect(
      deriveServiceUrls({
        adminHref: 'https://api.example.com/proxy/qaqdmin/#/setup',
        apiUrl: 'https://api.example.com/api/v2',
        gatewayUrl: 'https://api.example.com',
      }),
    ).toEqual({
      adminUrl: 'https://api.example.com/proxy/qaqdmin',
      serverUrl: 'https://api.example.com/api/v2',
      wsUrl: 'https://api.example.com',
    })
  })

  it('falls back to the api origin when no gateway is configured', () => {
    expect(
      deriveServiceUrls({
        adminHref: 'http://localhost:9528/',
        apiUrl: 'http://localhost:2333',
        gatewayUrl: '',
      }).wsUrl,
    ).toBe('http://localhost:2333')
  })
})

describe('onboarding progress', () => {
  afterEach(() => localStorage.clear())

  it('returns null when nothing was stored for the owner', () => {
    expect(readOnboardingProgress('owner-1')).toBeNull()
  })

  it('round-trips the progress per owner id', () => {
    writeOnboardingProgress('owner-1', { status: 'active', step: 'ai-models' })
    expect(readOnboardingProgress('owner-1')).toEqual({
      status: 'active',
      step: 'ai-models',
    })
    expect(readOnboardingProgress('owner-2')).toBeNull()
  })

  it('ignores malformed stored values', () => {
    localStorage.setItem('mx-admin:onboarding:owner-1', '{"step":42}')
    expect(readOnboardingProgress('owner-1')).toBeNull()
  })
})

describe('applyModelPlan', () => {
  const defaultModel = { model: 'claude-x', providerId: 'p1' }

  it('assigns the default model to every text feature left on follow-default', () => {
    const next = applyModelPlan({}, { defaultModel, overrides: {} })
    expect(next.writerModel).toEqual(defaultModel)
    expect(next.summaryModel).toEqual(defaultModel)
    expect(next.translationModel).toEqual(defaultModel)
    expect(next.translationReviewModel).toEqual(defaultModel)
    expect(next.insightsModel).toEqual(defaultModel)
  })

  it('keeps per-feature overrides and leaves speech and image unset without one', () => {
    const cheap = { model: 'small', providerId: 'p1' }
    const next = applyModelPlan(
      { enableSummary: true },
      { defaultModel, overrides: { summaryModel: cheap } },
    )
    expect(next.summaryModel).toEqual(cheap)
    expect(next.enableSummary).toBe(true)
    expect(next.tts?.model).toBeUndefined()
    expect(next.imageGeneration?.model).toBeUndefined()
  })

  it('writes speech and image overrides into their nested configs', () => {
    const speech = { model: 'tts-1', providerId: 'p2' }
    const next = applyModelPlan(
      { tts: { enable: false, voice: 'alloy' } },
      { defaultModel, overrides: { ttsModel: speech } },
    )
    expect(next.tts).toEqual({ enable: false, model: speech, voice: 'alloy' })
  })
})
