/**
 * Consumer-type smoke fixture for `@mx-space/api-client` public AI types.
 *
 * Purpose
 * -------
 * The AI SDK -> pi migration reshapes server-side runtime/SSE plumbing but
 * MUST keep the api-client public surface compatible with Shiro / Yohaku
 * (public consumer SPAs) and with this monorepo's `apps/admin`.
 *
 * Surface frozen by this fixture:
 *   - `AIProviderType` literal union  ('anthropic' | 'generic' | 'openai-compatible')
 *   - `AIProviderConfigModel`
 *   - `AISummaryModel`, `AISummaryStreamEvent`
 *   - `AITranslationModel`, `AITranslationStreamEvent`
 *   - `AIInsightsModel`, `AIInsightsStreamEvent`
 *   - `AIDeepReadingModel`
 *
 * Maintenance
 * -----------
 * If a consumer (Shiro/Yohaku) starts importing a NEW field, add a literal
 * assignment below — the assignment lines exist purely so tsc fails on a
 * silent shape drift. Do NOT loosen with `as` unless an explicit major bump
 * is planned and CHANGELOG documents it.
 */

import type {
  AIDeepReadingModel,
  AIInsightsModel,
  AIInsightsStreamEvent,
  AIProviderConfigModel,
  AIProviderType,
  AISummaryModel,
  AISummaryStreamEvent,
  AITranslationModel,
  AITranslationStreamEvent,
} from '../../models/ai'

// AIProviderType is a frozen 3-value literal union after step-3a.
const providerTypes: AIProviderType[] = [
  'anthropic',
  'generic',
  'openai-compatible',
]

const providerConfig: AIProviderConfigModel = {
  id: 'p1',
  name: 'OpenAI',
  type: 'openai-compatible',
  apiKey: 'sk-xxx',
  defaultModel: 'gpt-4o',
  enabled: true,
  endpoint: 'https://api.openai.com/v1',
  contextWindow: 128_000,
  maxTokens: 4096,
}

// nullable additive fields land as `?: number | null`
const providerConfigMinimal: AIProviderConfigModel = {
  id: 'p2',
  name: 'Local',
  type: 'generic',
  apiKey: '',
  defaultModel: 'local',
  enabled: false,
  contextWindow: null,
  maxTokens: null,
}

const summary: AISummaryModel = {
  id: '1',
  createdAt: '2026-05-30T00:00:00Z',
  summary: 'A short summary.',
  hash: 'h1',
  refId: 'post-1',
  lang: 'en',
}

const summaryNullLang: AISummaryModel = { ...summary, lang: null }

const translation: AITranslationModel = {
  id: '1',
  createdAt: '2026-05-30T00:00:00Z',
  hash: 'h1',
  refId: 'post-1',
  refType: 'post',
  lang: 'en',
  sourceLang: 'zh',
  title: 'Title',
  text: 'Body',
  subtitle: null,
  summary: null,
  tags: ['t1'],
  aiModel: 'gpt-4o',
  aiProvider: 'openai-compatible',
  contentFormat: 'markdown',
  content: '# Hi',
}

const insights: AIInsightsModel = {
  id: '1',
  createdAt: '2026-05-30T00:00:00Z',
  hash: 'h1',
  refId: 'post-1',
  lang: 'en',
  content: '{}',
  isTranslation: false,
  sourceInsightsId: null,
  sourceLang: null,
  modelInfo: { provider: 'openai-compatible', model: 'gpt-4o' },
}

const deepReading: AIDeepReadingModel = {
  id: '1',
  hash: 'h1',
  refId: 'post-1',
  keyPoints: ['k1'],
  criticalAnalysis: 'analysis',
  content: 'body',
}

// SSE stream event unions — token | done | error.
// `error.data` is documented as a JSON-encoded `{message: string}` string.
const summaryStream: AISummaryStreamEvent[] = [
  { type: 'token', data: 'hello' },
  { type: 'done', data: undefined },
  { type: 'error', data: JSON.stringify({ message: 'fail' }) },
]

const translationStream: AITranslationStreamEvent[] = [
  { type: 'token', data: 't' },
  { type: 'done', data: undefined },
  { type: 'error', data: JSON.stringify({ message: 'fail' }) },
]

const insightsStream: AIInsightsStreamEvent[] = [
  { type: 'token', data: 't' },
  { type: 'done', data: undefined },
  { type: 'error', data: JSON.stringify({ message: 'fail' }) },
]

// Reference all bindings so tsc treats them as type-asserted, not dead code.
export const __consumerSmoke = {
  providerTypes,
  providerConfig,
  providerConfigMinimal,
  summary,
  summaryNullLang,
  translation,
  insights,
  deepReading,
  summaryStream,
  translationStream,
  insightsStream,
}
