import { dump, load, YAMLException } from 'js-yaml'
import JSON5 from 'json5'
import { toast } from 'sonner'

import type { CreateSnippetData } from '~/api/snippets'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { SnippetModel } from '~/models/snippet'
import { defaultServerlessFunction, SnippetType } from '~/models/snippet'

export const defaultSkillMarkdown = `---
name: <new-skill>
description: One-line description shown in skill cards.
---

# Skill body

Write the AI-facing instructions here.
`

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function normalizeSnippet(snippet: CreateSnippetData | SnippetModel) {
  return {
    comment: snippet.comment ?? '',
    customPath: snippet.customPath ?? '',
    enable: Boolean(snippet.enable),
    metatype: snippet.metatype ?? '',
    method: snippet.method ?? '',
    name: snippet.name ?? '',
    private: Boolean(snippet.private),
    raw: snippet.raw ?? '',
    reference: snippet.reference ?? 'root',
    schema: snippet.schema ?? '',
    secret: serializeSnippetSecret(snippet.secret),
    type: snippet.type ?? SnippetType.JSON,
  } satisfies CreateSnippetData
}

export function prepareSnippetPayload(
  form: CreateSnippetData,
  t: Translator,
): CreateSnippetData {
  const payload: CreateSnippetData = {
    ...form,
    raw: normalizeSnippetRawForSave(form.type, form.raw, t),
  }

  if (!payload.metatype) delete payload.metatype
  if (!payload.schema) delete payload.schema
  if (!payload.customPath) delete payload.customPath
  if (!payload.method) delete payload.method
  if (payload.secret) payload.secret = parseSnippetSecret(payload.secret)
  else delete payload.secret

  return payload
}

export function normalizeSnippetRawForSave(
  type: SnippetType,
  raw: string,
  t: Translator,
) {
  switch (type) {
    case SnippetType.JSON: {
      try {
        return JSON.stringify(JSON.parse(raw))
      } catch {
        throw new Error(t('snippets.error.jsonInvalid'))
      }
    }
    case SnippetType.YAML: {
      try {
        load(raw)
        return raw
      } catch {
        throw new Error(t('snippets.error.yamlInvalid'))
      }
    }
    case SnippetType.JSON5: {
      try {
        JSON5.parse(raw)
        return raw
      } catch {
        throw new Error(t('snippets.error.json5Invalid'))
      }
    }
    case SnippetType.Skill: {
      return raw
    }
    case SnippetType.Function:
    case SnippetType.Text: {
      return raw
    }
  }
}

export function getSnippetDefaultsForType(
  type: SnippetType,
  previousType: SnippetType,
  previousRaw: string,
  t: Translator,
): Partial<CreateSnippetData> {
  if (type === previousType) return {}

  if (type === SnippetType.Function) {
    return {
      enable: true,
      method: 'GET',
      raw: defaultServerlessFunction,
    }
  }

  if (type === SnippetType.Text) {
    return {
      enable: undefined,
      method: undefined,
      raw: '',
    }
  }

  if (type === SnippetType.Skill) {
    return {
      enable: undefined,
      method: undefined,
      raw: defaultSkillMarkdown,
    }
  }

  const value =
    previousType === SnippetType.JSON ||
    previousType === SnippetType.JSON5 ||
    previousType === SnippetType.YAML
      ? readStructuredSnippetRaw(previousType, previousRaw, t)
      : { name: 'hello world' }

  return {
    enable: undefined,
    method: undefined,
    raw: writeStructuredSnippetRaw(type, value),
  }
}

export function readStructuredSnippetRaw(
  type: SnippetType,
  raw: string,
  t: Translator,
) {
  try {
    switch (type) {
      case SnippetType.JSON: {
        return JSON.parse(raw)
      }
      case SnippetType.JSON5: {
        return JSON5.parse(raw)
      }
      case SnippetType.YAML: {
        return load(raw)
      }
      case SnippetType.Skill:
      case SnippetType.Function:
      case SnippetType.Text: {
        return raw
      }
    }
  } catch {
    toast.warning(t('snippets.toast.convertFallback'))
    return { name: 'hello world' }
  }
}

export function writeStructuredSnippetRaw(type: SnippetType, value: unknown) {
  switch (type) {
    case SnippetType.JSON: {
      return JSON.stringify(value ?? {}, null, 2)
    }
    case SnippetType.JSON5: {
      return JSON5.stringify(value ?? {}, null, 2)
    }
    case SnippetType.YAML: {
      return dump(value)
    }
    case SnippetType.Skill:
    case SnippetType.Function:
    case SnippetType.Text: {
      return String(value ?? '')
    }
  }
}

export function serializeSnippetSecret(secret: CreateSnippetData['secret']) {
  if (!secret) return ''
  if (typeof secret === 'string') return secret

  return JSON.stringify(secret, null, 2)
}

export function parseSnippetSecret(secret: CreateSnippetData['secret']) {
  if (!secret || typeof secret !== 'string') return secret
  const text = secret.trim()
  if (!text) return undefined
  try {
    return JSON5.parse(text) as Record<string, unknown>
  } catch {
    return text
  }
}

export function basenameWithoutExt(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

export function parsePackageInput(input: string) {
  return input
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function logLevelColor(level: string) {
  switch (level) {
    case 'warn': {
      return 'text-amber-700 dark:text-amber-400'
    }
    case 'error': {
      return 'text-red-700 dark:text-red-400'
    }
    case 'info': {
      return 'text-blue-700 dark:text-blue-400'
    }
    case 'debug': {
      return 'text-neutral-600 dark:text-neutral-400'
    }
    default: {
      return 'text-neutral-700 dark:text-neutral-300'
    }
  }
}

export function formatLogArgs(args: unknown[]) {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      try {
        return JSON.stringify(arg, null, 2)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const FRONTMATTER_REGEX = /^---[\t ]*\r?\n(.*?)\r?\n---[\t ]*\r?\n/s

export function parseSkillFrontmatter(raw: string):
  | {
      ok: true
      name: string | undefined
      description: string | undefined
      unknownKeys: Array<{ key: string; preview: string }>
    }
  | { ok: false; errorMessage: string } {
  const match = FRONTMATTER_REGEX.exec(raw)
  if (!match) {
    return {
      ok: true,
      name: undefined,
      description: undefined,
      unknownKeys: [],
    }
  }

  let parsed: unknown
  try {
    parsed = load(match[1])
  } catch (e) {
    return {
      ok: false,
      errorMessage: e instanceof YAMLException ? e.message : String(e),
    }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errorMessage: 'frontmatter must be a YAML object' }
  }

  const obj = parsed as Record<string, unknown>
  const name = typeof obj.name === 'string' ? obj.name : undefined
  const description =
    typeof obj.description === 'string' ? obj.description : undefined

  const unknownKeys: Array<{ key: string; preview: string }> = []
  for (const key of Object.keys(obj)) {
    if (key === 'name' || key === 'description') continue
    const serialized = JSON.stringify(obj[key])
    unknownKeys.push({
      key,
      preview:
        serialized.length > 60 ? serialized.slice(0, 60) + '…' : serialized,
    })
  }

  return { ok: true, name, description, unknownKeys }
}
