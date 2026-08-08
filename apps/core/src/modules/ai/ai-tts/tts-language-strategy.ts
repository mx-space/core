import { getLanguageName } from '../ai-language.util'

export interface TtsLanguageStrategyContext {
  baseUrl: string
  language: string
  model: string
}

export interface TtsLanguageStrategyResolution {
  audioFormat?: 'wav'
  cacheKey: string
  requestParams: Record<string, unknown>
  responseFormat?: 'pcm'
  strategyId: string
  transformInput?: (input: string) => string
}

export interface TtsLanguageStrategy {
  buildRequestParams: (
    context: TtsLanguageStrategyContext,
  ) => Record<string, unknown>
  audioFormat?: 'wav'
  id: string
  matches: (context: TtsLanguageStrategyContext) => boolean
  responseFormat?: 'pcm'
  transformInput?: (
    input: string,
    context: TtsLanguageStrategyContext,
  ) => string
  version: number
}

export class TtsLanguageStrategyRegistry {
  private readonly strategies: TtsLanguageStrategy[] = []

  register(strategy: TtsLanguageStrategy): this {
    if (this.strategies.some(({ id }) => id === strategy.id)) {
      throw new Error(`duplicate TTS language strategy: ${strategy.id}`)
    }
    this.strategies.push(strategy)
    return this
  }

  resolve(context: TtsLanguageStrategyContext): TtsLanguageStrategyResolution {
    const normalized = {
      ...context,
      language: context.language.trim().toLowerCase(),
    }
    const strategy = this.strategies.find((item) => item.matches(normalized))
    if (!strategy) {
      return {
        cacheKey: 'auto:v1',
        requestParams: {},
        strategyId: 'auto',
      }
    }

    return {
      ...(strategy.audioFormat ? { audioFormat: strategy.audioFormat } : {}),
      cacheKey: `${strategy.id}:v${strategy.version}:${normalized.language}`,
      requestParams: strategy.buildRequestParams(normalized),
      ...(strategy.responseFormat
        ? { responseFormat: strategy.responseFormat }
        : {}),
      strategyId: strategy.id,
      ...(strategy.transformInput
        ? {
            transformInput: (input: string) =>
              strategy.transformInput!(input, normalized),
          }
        : {}),
    }
  }
}

function hostnameOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function modelVendor(model: string): string {
  return model.includes('/') ? model.split('/', 1)[0].toLowerCase() : ''
}

function modelName(model: string): string {
  return (model.split('/').at(-1) ?? model).toLowerCase()
}

function isOpenRouter(context: TtsLanguageStrategyContext): boolean {
  return hostnameOf(context.baseUrl) === 'openrouter.ai'
}

function isInstructionCapableOpenAiModel(model: string): boolean {
  return /^gpt-4o(?:-mini)?-tts(?:-|$)/.test(modelName(model))
}

function buildOpenAiInstructions(language: string): string {
  const name = getLanguageName(language)
  return `Speak the entire input in ${name} (${language}). Use ${name} pronunciations for ambiguous characters and words.`
}

function buildGeminiInput(
  input: string,
  context: TtsLanguageStrategyContext,
): string {
  const language = context.language
  const name =
    language === 'zh' ? 'Mandarin Chinese' : getLanguageName(language)
  const locale =
    {
      ja: 'ja-JP',
      zh: 'zh-CN',
    }[language] ?? language

  return `Language: ${name} (${locale}). Speak only the transcript. Use ${name} pronunciation for every ambiguous character.\n\nTranscript:\n${input}`
}

const XAI_LANGUAGE_DEFAULTS: Readonly<Record<string, string>> = {
  ar: 'ar-SA',
  es: 'es-ES',
  pt: 'pt-BR',
}

const MINIMAX_LANGUAGE_BOOSTS: Readonly<Record<string, string>> = {
  af: 'Afrikaans',
  ar: 'Arabic',
  bg: 'Bulgarian',
  ca: 'Catalan',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  fa: 'Persian',
  fi: 'Finnish',
  fil: 'Filipino',
  fr: 'French',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ms: 'Malay',
  nl: 'Dutch',
  nn: 'Nynorsk',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sv: 'Swedish',
  ta: 'Tamil',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
  yue: 'Chinese,Yue',
  zh: 'Chinese',
}

export const defaultTtsLanguageStrategyRegistry =
  new TtsLanguageStrategyRegistry()
    .register({
      id: 'openrouter-google-gemini-prompt',
      version: 1,
      matches: (context) =>
        isOpenRouter(context) &&
        modelVendor(context.model) === 'google' &&
        /^gemini-.*tts(?:-|$)/.test(modelName(context.model)),
      buildRequestParams: () => ({}),
      audioFormat: 'wav',
      responseFormat: 'pcm',
      transformInput: buildGeminiInput,
    })
    .register({
      id: 'openrouter-xai-language',
      version: 1,
      matches: (context) =>
        isOpenRouter(context) &&
        modelVendor(context.model) === 'x-ai' &&
        modelName(context.model).startsWith('grok-voice-tts'),
      buildRequestParams: ({ language }) => ({
        provider: {
          options: {
            xai: { language: XAI_LANGUAGE_DEFAULTS[language] ?? language },
          },
        },
      }),
    })
    .register({
      id: 'openrouter-minimax-language-boost',
      version: 1,
      matches: (context) =>
        isOpenRouter(context) &&
        modelVendor(context.model) === 'minimax' &&
        MINIMAX_LANGUAGE_BOOSTS[context.language] !== undefined,
      buildRequestParams: ({ language }) => ({
        provider: {
          options: {
            minimax: {
              language_boost: MINIMAX_LANGUAGE_BOOSTS[language],
            },
          },
        },
      }),
    })
    .register({
      id: 'openrouter-openai-instructions',
      version: 1,
      matches: (context) =>
        isOpenRouter(context) &&
        modelVendor(context.model) === 'openai' &&
        isInstructionCapableOpenAiModel(context.model),
      buildRequestParams: ({ language }) => ({
        provider: {
          options: {
            openai: { instructions: buildOpenAiInstructions(language) },
          },
        },
      }),
    })
    .register({
      id: 'openai-instructions',
      version: 1,
      matches: (context) =>
        hostnameOf(context.baseUrl) === 'api.openai.com' &&
        isInstructionCapableOpenAiModel(context.model),
      buildRequestParams: ({ language }) => ({
        instructions: buildOpenAiInstructions(language),
      }),
    })
