import type {
  MetaFieldDescriptor,
  MetaFieldsSchema,
} from '~/vendor/rich-editor/utils/meta-tools'

type WriteKind = 'note' | 'page' | 'post'

export interface AgentMetaFormState {
  bookmark: boolean
  contentFormat: 'lexical' | 'markdown'
  copyright: boolean
  freeUntil: string
  freeWindowHours: string
  isPremium: boolean
  location: string
  mood: string
  order: string
  pin: boolean
  pinOrder: string
  previewBlocks: string
  purchaseEnabled: boolean
  slug: string
  subtitle: string
  summary: string
  tags: string
  title: string
  weather: string
}

interface AgentMetaField {
  descriptor: MetaFieldDescriptor
  read: (state: AgentMetaFormState) => unknown
  write: (state: AgentMetaFormState, value: unknown) => AgentMetaFormState
}

type FieldRegistry = Record<string, AgentMetaField>

const toText = (value: unknown) => String(value ?? '')
const toCount = (value: unknown) => String(Number(value ?? 0) || 0)

function requireBoolean(key: string, value: unknown) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${key} must be a boolean`)
  }
  return value
}

function requireInteger(key: string, value: unknown, min: number) {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < min) {
    throw new TypeError(`${key} must be an integer >= ${min}`)
  }
  return parsed
}

function splitCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function textField(description: string, key: keyof AgentMetaFormState) {
  return {
    descriptor: { description, type: 'string' },
    read: (state) => state[key],
    write: (state, value) => ({ ...state, [key]: toText(value) }),
  } satisfies AgentMetaField
}

function flagField(description: string, key: keyof AgentMetaFormState) {
  return {
    descriptor: { description, type: 'boolean' },
    read: (state) => state[key],
    write: (state, value) => ({ ...state, [key]: Boolean(value) }),
  } satisfies AgentMetaField
}

const slugField = (example?: string): AgentMetaField => ({
  descriptor: {
    description: example
      ? 'URL path segment; prefer lowercase English words joined with hyphens.'
      : 'URL path segment; may be empty (then the nid path is used).',
    ...(example ? { example } : {}),
    type: 'string',
  },
  read: (state) => state.slug,
  write: (state, value) => ({ ...state, slug: toText(value) }),
})

const PAYWALL_FIELDS: FieldRegistry = {
  isPremium: {
    descriptor: {
      description:
        'Whether the post is premium (paywalled). Requires Lexical content.',
      type: 'boolean',
    },
    read: (state) => state.isPremium,
    write: (state, value) => {
      const isPremium = requireBoolean('isPremium', value)
      if (isPremium && state.contentFormat !== 'lexical') {
        throw new Error('isPremium requires Lexical content')
      }
      return { ...state, isPremium }
    },
  },
  purchaseEnabled: {
    descriptor: {
      description:
        'Whether readers can buy the premium post. Only applies when isPremium is true.',
      type: 'boolean',
    },
    read: (state) => state.purchaseEnabled,
    write: (state, value) => ({
      ...state,
      purchaseEnabled: requireBoolean('purchaseEnabled', value),
    }),
  },
  freeUntil: {
    descriptor: {
      description:
        'ISO datetime until which the premium post is free to read; empty string or null clears it. Only applies when isPremium is true.',
      example: '2026-12-01T00:00:00.000Z',
      type: 'string',
    },
    read: (state) => state.freeUntil || null,
    write: (state, value) => {
      if (value == null || value === '') return { ...state, freeUntil: '' }
      const date = typeof value === 'string' ? new Date(value) : null
      if (!date || Number.isNaN(date.getTime())) {
        throw new TypeError('freeUntil must be an ISO datetime string')
      }
      return { ...state, freeUntil: date.toISOString() }
    },
  },
  freeWindowHours: {
    descriptor: {
      description:
        'Hours after publishing during which the premium post is free. Only applies when isPremium is true.',
      type: 'number',
    },
    read: (state) => Number(state.freeWindowHours),
    write: (state, value) => ({
      ...state,
      freeWindowHours: String(requireInteger('freeWindowHours', value, 0)),
    }),
  },
  previewBlocks: {
    descriptor: {
      description:
        'Number of leading blocks visible before the paywall. Only applies when isPremium is true.',
      type: 'number',
    },
    read: (state) => Number(state.previewBlocks),
    write: (state, value) => ({
      ...state,
      previewBlocks: String(requireInteger('previewBlocks', value, 1)),
    }),
  },
}

const POST_FIELDS: FieldRegistry = {
  title: textField('Post title', 'title'),
  slug: slugField('my-first-post'),
  tags: {
    descriptor: { description: 'Post tag list', type: 'string[]' },
    read: (state) => splitCommaList(state.tags),
    write: (state, value) =>
      Array.isArray(value)
        ? { ...state, tags: value.map((tag) => String(tag)).join(', ') }
        : state,
  },
  summary: textField('Post summary; leave empty to auto-generate.', 'summary'),
  copyright: flagField(
    'Whether to show the copyright notice at the end.',
    'copyright',
  ),
  pin: {
    descriptor: { description: 'Whether the post is pinned', type: 'boolean' },
    read: (state) => state.pin,
    write: (state, value) => {
      const pin = Boolean(value)
      if (!pin) return { ...state, pin, pinOrder: '0' }
      const pinOrder =
        !state.pinOrder || Number(state.pinOrder) === 0 ? '1' : state.pinOrder
      return { ...state, pin, pinOrder }
    },
  },
  pinOrder: {
    descriptor: {
      description:
        'Pin order; higher numbers float to the top; set to 0 when pin is off.',
      type: 'number',
    },
    read: (state) => Number(state.pinOrder) || 0,
    write: (state, value) => ({ ...state, pinOrder: toCount(value) }),
  },
  ...PAYWALL_FIELDS,
}

const NOTE_FIELDS: FieldRegistry = {
  title: textField('Note title', 'title'),
  slug: slugField(),
  mood: textField('Mood', 'mood'),
  weather: textField('Weather', 'weather'),
  bookmark: flagField('Whether to mark as a bookmarked memory.', 'bookmark'),
  location: textField('Location text (optional).', 'location'),
}

const PAGE_FIELDS: FieldRegistry = {
  title: textField('Page title', 'title'),
  slug: slugField('about'),
  subtitle: textField('Subtitle', 'subtitle'),
  order: {
    descriptor: {
      description: 'Navigation order; smaller numbers come first.',
      type: 'number',
    },
    read: (state) => Number(state.order) || 0,
    write: (state, value) => ({ ...state, order: toCount(value) }),
  },
}

const REGISTRY: Record<WriteKind, FieldRegistry> = {
  note: NOTE_FIELDS,
  page: PAGE_FIELDS,
  post: POST_FIELDS,
}

const schemaCache = new Map<WriteKind, MetaFieldsSchema>()

export function getWriteAgentMetaSchema(kind: WriteKind): MetaFieldsSchema {
  let schema = schemaCache.get(kind)
  if (!schema) {
    schema = Object.fromEntries(
      Object.entries(REGISTRY[kind]).map(([key, field]) => [
        key,
        field.descriptor,
      ]),
    )
    schemaCache.set(kind, schema)
  }
  return schema
}

export function getWriteAgentMetaFields(
  kind: WriteKind,
  state: AgentMetaFormState,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(REGISTRY[kind]).map(([key, field]) => [
      key,
      field.read(state),
    ]),
  )
}

export function applyWriteAgentMetaUpdates<S extends AgentMetaFormState>(
  kind: WriteKind,
  state: S,
  updates: Record<string, unknown>,
): S {
  const fields = REGISTRY[kind]
  let next: AgentMetaFormState = state
  for (const [key, field] of Object.entries(fields)) {
    if (key in updates) next = field.write(next, updates[key])
  }
  return next as S
}
