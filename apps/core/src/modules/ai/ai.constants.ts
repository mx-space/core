import { OpenAI } from 'openai'
import type { ChatModel } from 'openai/resources'

export const DEFAULT_SUMMARY_LANG = 'zh'
type _Models = ChatModel
export const LANGUAGE_CODE_TO_NAME = {
  ar: 'Arabic',
  bg: 'Bulgarian',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  et: 'Estonian',
  fa: 'Persian',
  fi: 'Finnish',
  fr: 'French',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  id: 'Indonesian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  lt: 'Lithuanian',
  lv: 'Latvian',
  ms: 'Malay',
  nl: 'Dutch',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sr: 'Serbian',
  sv: 'Swedish',
  sw: 'Swahili',
  th: 'Thai',
  tl: 'Tagalog',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  zh: 'Chinese',
}

export const OpenAiSupportedModels = [
  {
    label: 'o3-mini',
    value: 'o3-mini',
  },
  {
    label: 'o3-mini-2025-01-31',
    value: 'o3-mini-2025-01-31',
  },
  {
    label: 'o1',
    value: 'o1',
  },
  {
    label: 'o1-2024-12-17',
    value: 'o1-2024-12-17',
  },
  {
    label: 'o1-preview',
    value: 'o1-preview',
  },
  {
    label: 'o1-preview-2024-09-12',
    value: 'o1-preview-2024-09-12',
  },
  {
    label: 'o1-mini',
    value: 'o1-mini',
  },
  {
    label: 'o1-mini-2024-09-12',
    value: 'o1-mini-2024-09-12',
  },
  {
    label: 'gpt-4o',
    value: 'gpt-4o',
  },
  {
    label: 'gpt-4o-2024-11-20',
    value: 'gpt-4o-2024-11-20',
  },
  {
    label: 'gpt-4o-2024-08-06',
    value: 'gpt-4o-2024-08-06',
  },
  {
    label: 'gpt-4o-2024-05-13',
    value: 'gpt-4o-2024-05-13',
  },
  {
    label: 'gpt-4o-audio-preview',
    value: 'gpt-4o-audio-preview',
  },
  {
    label: 'gpt-4o-audio-preview-2024-10-01',
    value: 'gpt-4o-audio-preview-2024-10-01',
  },
  {
    label: 'gpt-4o-audio-preview-2024-12-17',
    value: 'gpt-4o-audio-preview-2024-12-17',
  },
  {
    label: 'gpt-4o-mini-audio-preview',
    value: 'gpt-4o-mini-audio-preview',
  },
  {
    label: 'gpt-4o-mini-2024-07-18',
    value: 'gpt-4o-mini-2024-07-18',
  },
  {
    label: 'gpt-4-turbo',
    value: 'gpt-4-turbo',
  },
  {
    label: 'gpt-4-turbo-2024-04-09',
    value: 'gpt-4-turbo-2024-04-09',
  },
  {
    label: 'gpt-4-0125-preview',
    value: 'gpt-4-0125-preview',
  },
  {
    label: 'gpt-4-turbo-preview',
    value: 'gpt-4-turbo-preview',
  },
  {
    label: 'gpt-4-1106-preview',
    value: 'gpt-4-1106-preview',
  },
  {
    label: 'gpt-4-vision-preview',
    value: 'gpt-4-vision-preview',
  },
  {
    label: 'gpt-4',
    value: 'gpt-4',
  },
  {
    label: 'gpt-4-0314',
    value: 'gpt-4-0314',
  },
  {
    label: 'gpt-4-0613',
    value: 'gpt-4-0613',
  },
  {
    label: 'gpt-4-32k',
    value: 'gpt-4-32k',
  },
  {
    label: 'gpt-4-32k-0314',
    value: 'gpt-4-32k-0314',
  },
  {
    label: 'gpt-4-32k-0613',
    value: 'gpt-4-32k-0613',
  },
  {
    label: 'gpt-3.5-turbo',
    value: 'gpt-3.5-turbo',
  },
  {
    label: 'gpt-3.5-turbo-16k',
    value: 'gpt-3.5-turbo-16k',
  },
  {
    label: 'gpt-3.5-turbo-0301',
    value: 'gpt-3.5-turbo-0301',
  },
  {
    label: 'gpt-3.5-turbo-0613',
    value: 'gpt-3.5-turbo-0613',
  },
  {
    label: 'gpt-3.5-turbo-1106',
    value: 'gpt-3.5-turbo-1106',
  },
  {
    label: 'gpt-3.5-turbo-0125',
    value: 'gpt-3.5-turbo-0125',
  },
  {
    label: 'gpt-3.5-turbo-16k-0613',
    value: 'gpt-3.5-turbo-16k-0613',
  },
]
