export type LexicalTranslatablePropertyName =
  | 'summary'
  | 'definitions'
  | 'reading'

export interface LexicalTranslatableProperty {
  property: LexicalTranslatablePropertyName
  text: string
  key?: string
}

type LexicalNodeRecord = Record<string, unknown>

export interface LexicalTranslatablePropertyWhitelistEntry {
  nodeType: 'details' | 'footnote-section' | 'ruby'
  property: LexicalTranslatablePropertyName
  sourceField: 'summary' | 'definitions' | 'reading'
  valueShape: 'string' | 'record'
}

export const LEXICAL_TRANSLATABLE_PROPERTY_WHITELIST = [
  {
    nodeType: 'details',
    property: 'summary',
    sourceField: 'summary',
    valueShape: 'string',
  },
  {
    nodeType: 'footnote-section',
    property: 'definitions',
    sourceField: 'definitions',
    valueShape: 'record',
  },
  {
    nodeType: 'ruby',
    property: 'reading',
    sourceField: 'reading',
    valueShape: 'string',
  },
] as const satisfies readonly LexicalTranslatablePropertyWhitelistEntry[]

const PROPERTY_WHITELIST_BY_NODE_TYPE = new Map(
  LEXICAL_TRANSLATABLE_PROPERTY_WHITELIST.map((entry) => [
    entry.nodeType,
    entry,
  ]),
)

export function extractLexicalTranslatableProperties(
  node: unknown,
): LexicalTranslatableProperty[] {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return []
  }

  const lexicalNode = node as LexicalNodeRecord
  const nodeType = lexicalNode.type
  if (typeof nodeType !== 'string') {
    return []
  }

  const whitelistEntry = PROPERTY_WHITELIST_BY_NODE_TYPE.get(
    nodeType as LexicalTranslatablePropertyWhitelistEntry['nodeType'],
  )
  if (!whitelistEntry) {
    return []
  }

  const sourceValue = lexicalNode[whitelistEntry.sourceField]
  if (whitelistEntry.valueShape === 'string') {
    if (typeof sourceValue !== 'string' || !sourceValue.trim()) {
      return []
    }

    return [{ property: whitelistEntry.property, text: sourceValue }]
  }

  if (
    !sourceValue ||
    typeof sourceValue !== 'object' ||
    Array.isArray(sourceValue)
  ) {
    return []
  }

  return Object.entries(sourceValue).flatMap(([key, value]) => {
    if (typeof value !== 'string' || !value.trim()) {
      return []
    }

    return [{ property: whitelistEntry.property, key, text: value }]
  })
}
