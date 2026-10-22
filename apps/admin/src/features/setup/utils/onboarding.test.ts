import { afterEach, describe, expect, it } from 'vitest'

import {
  applyModelPlan,
  buildModelOptions,
  claimPendingOnboarding,
  deriveServiceUrls,
  isValidOnboardingUsername,
  markOnboardingPending,
  nextSummaryLanguages,
  parseModelOption,
  readOnboardingProgress,
  removeProviderFromConfig,
  resolveResumeStep,
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

describe('resolveResumeStep', () => {
  it('keeps installs without an active run out of onboarding', () => {
    expect(resolveResumeStep(null)).toBeNull()
    expect(resolveResumeStep({ status: 'finished', step: 'ready' })).toBeNull()
  })

  it('resumes an active or dismissed run at its saved step', () => {
    expect(resolveResumeStep({ status: 'active', step: 'ai-models' })).toBe(
      'ai-models',
    )
    expect(resolveResumeStep({ status: 'dismissed', step: 'ready' })).toBe(
      'ready',
    )
  })

  it('never resumes into the unauthenticated steps', () => {
    expect(resolveResumeStep({ status: 'active', step: 'account' })).toBe(
      'site',
    )
  })
})

describe('pending onboarding', () => {
  afterEach(() => localStorage.clear())

  it('hands a run started before sign-in to the owner who signs in', () => {
    markOnboardingPending()
    expect(claimPendingOnboarding('owner-1')).toEqual({
      status: 'active',
      step: 'site',
    })
    expect(readOnboardingProgress('owner-1')).toEqual({
      status: 'active',
      step: 'site',
    })
    expect(claimPendingOnboarding('owner-1')).toBeNull()
  })
})

describe('isValidOnboardingUsername', () => {
  it('accepts what username sign-in accepts', () => {
    expect(isValidOnboardingUsername('innei')).toBe(true)
    expect(isValidOnboardingUsername('in.nei-_1')).toBe(true)
  })

  it('rejects names sign-in would refuse', () => {
    expect(isValidOnboardingUsername('ab')).toBe(false)
    expect(isValidOnboardingUsername('张三')).toBe(false)
    expect(isValidOnboardingUsername('Innei Li')).toBe(false)
    expect(isValidOnboardingUsername('a'.repeat(31))).toBe(false)
  })
})

describe('model options', () => {
  const groups = [
    {
      models: [
        { id: 'claude-x', name: 'Claude X' },
        { id: 'claude-y', name: '' },
      ],
      providerId: 'p1',
      providerName: 'Anthropic',
      providerType: 'anthropic',
    },
    {
      error: 'boom',
      models: [],
      providerId: 'p2',
      providerName: 'Broken',
      providerType: 'openai-compatible',
    },
  ]

  it('flattens provider model groups into labelled options', () => {
    expect(buildModelOptions(groups)).toEqual([
      { label: 'Anthropic · Claude X', value: 'p1::claude-x' },
      { label: 'Anthropic · claude-y', value: 'p1::claude-y' },
    ])
  })

  it('parses an option value back into an assignment', () => {
    expect(parseModelOption('p1::org/model:free')).toEqual({
      model: 'org/model:free',
      providerId: 'p1',
    })
    expect(parseModelOption('')).toBeNull()
  })
})

describe('applyModelPlan clearing media models', () => {
  it('clears a saved speech model when the plan sets it to none', () => {
    const speech = { model: 'tts-1', providerId: 'p2' }
    const next = applyModelPlan(
      { tts: { enable: true, model: speech } },
      { defaultModel: null, overrides: { ttsModel: null } },
    )
    expect(next.tts?.model).toBeNull()
  })
})

describe('removeProviderFromConfig', () => {
  it('drops the provider and every assignment that points at it', () => {
    const gone = { model: 'x', providerId: 'p1' }
    const kept = { model: 'y', providerId: 'p2' }
    const next = removeProviderFromConfig(
      {
        imageGeneration: { model: gone },
        providers: [
          {
            apiKey: '',
            defaultModel: 'x',
            enabled: true,
            id: 'p1',
            name: 'A',
            type: 'anthropic',
          },
          {
            apiKey: '',
            defaultModel: 'y',
            enabled: true,
            id: 'p2',
            name: 'B',
            type: 'anthropic',
          },
        ],
        summaryModel: kept,
        tts: { enable: true, model: gone },
        writerModel: gone,
      },
      'p1',
    )
    expect(next.providers?.map((provider) => provider.id)).toEqual(['p2'])
    expect(next.writerModel).toBeNull()
    expect(next.summaryModel).toEqual(kept)
    expect(next.tts?.model).toBeNull()
    expect(next.imageGeneration?.model).toBeNull()
  })
})

describe('nextSummaryLanguages', () => {
  it('follows the translation languages while summary has no own list', () => {
    expect(nextSummaryLanguages({}, ['en', 'ja'])).toEqual(['en', 'ja'])
  })

  it('keeps following after the lists were synced once', () => {
    expect(
      nextSummaryLanguages(
        { summaryTargetLanguages: ['en'], translationTargetLanguages: ['en'] },
        ['en', 'ja'],
      ),
    ).toEqual(['en', 'ja'])
  })

  it('keeps a summary list that was set separately', () => {
    expect(
      nextSummaryLanguages(
        { summaryTargetLanguages: ['fr'], translationTargetLanguages: ['en'] },
        ['en', 'ja'],
      ),
    ).toEqual(['fr'])
  })
})
