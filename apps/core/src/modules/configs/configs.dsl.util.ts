import { z } from 'zod'
import { configSchemaMapping, FullConfigSchema } from './configs.schema'
import { getMeta, type SchemaMetadata } from './configs.zod-schema.util'

// ==================== DSL Type Definitions ====================

export type UIComponent =
  | 'input'
  | 'password'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'select'
  | 'tags'

export interface UIConfig {
  component: UIComponent
  halfGrid?: boolean
  hidden?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string | number }>
  /**
   * Conditionally show this field based on sibling field values.
   * When the condition is not met, the field and all its nested children are hidden.
   */
  showWhen?: Record<string, string | string[]>
}

export interface FormField {
  key: string
  title: string
  description?: string
  required?: boolean
  ui: UIConfig
  fields?: FormField[]
}

export interface FormSection {
  key: string
  title: string
  description?: string
  hidden?: boolean
  fields: FormField[]
}

export interface FormGroup {
  key: string
  title: string
  description: string
  icon: string
  sections: FormSection[]
}

export interface FormDSL {
  title: string
  description?: string
  groups: FormGroup[]
  defaults: Record<string, any>
}

// ==================== Group Configuration ====================

interface GroupConfig {
  key: string
  title: string
  description: string
  icon: string
  sectionKeys: string[]
}

const groupConfigs: GroupConfig[] = [
  {
    key: 'site',
    title: '网站',
    description: '站点地址、SEO',
    icon: 'globe',
    sectionKeys: ['url', 'seo'],
  },
  {
    key: 'content',
    title: '内容',
    description: '评论、文本、友链',
    icon: 'file-text',
    sectionKeys: ['commentOptions', 'textOptions', 'friendLinkOptions'],
  },
  {
    key: 'notification',
    title: '通知',
    description: '邮件、Bark 推送',
    icon: 'bell',
    sectionKeys: ['mailOptions', 'barkOptions'],
  },
  {
    key: 'search',
    title: '搜索推送',
    description: '搜索引擎、全文检索',
    icon: 'search',
    sectionKeys: [
      'baiduSearchOptions',
      'bingSearchOptions',
      'algoliaSearchOptions',
    ],
  },
  {
    key: 'storage',
    title: '存储',
    description: '备份、图床',
    icon: 'database',
    sectionKeys: ['backupOptions', 'imageStorageOptions'],
  },
  {
    key: 'ai',
    title: 'AI',
    description: 'AI 摘要、写作助手',
    icon: 'sparkles',
    sectionKeys: ['ai'],
  },
  {
    key: 'system',
    title: '系统',
    description: '后台设置、功能开关',
    icon: 'settings',
    sectionKeys: ['adminExtra', 'featureList', 'thirdPartyServiceIntegration'],
  },
]

// ==================== Type Inference Utilities ====================

function unwrapZodType(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional) {
    return unwrapZodType(schema.unwrap() as unknown as z.ZodTypeAny)
  }
  if (schema instanceof z.ZodNullable) {
    return unwrapZodType(schema.unwrap() as unknown as z.ZodTypeAny)
  }
  if (schema instanceof z.ZodDefault) {
    // Zod v4 public API
    return unwrapZodType(schema.removeDefault() as unknown as z.ZodTypeAny)
  }
  if (schema instanceof z.ZodPipe) {
    // `z.preprocess`, `transform`, etc.
    return unwrapZodType(schema.out as unknown as z.ZodTypeAny)
  }
  return schema
}

function isEnumLikeSchema(schema: z.ZodTypeAny): boolean {
  if (schema instanceof z.ZodEnum) return true
  const enumObj = (schema as any)?.enum
  if (enumObj && typeof enumObj === 'object') return true
  // ZodUnion also has an `options` property, but it contains Zod schemas, not enum values
  // We need to exclude ZodUnion to avoid misidentifying union types as enums
  if (schema instanceof z.ZodUnion) return false
  const options = (schema as any)?.options
  return Array.isArray(options)
}

function inferUIComponent(
  schema: z.ZodTypeAny,
  meta: SchemaMetadata | undefined,
): UIComponent {
  const uiOptions = meta?.['ui:options']

  if (uiOptions?.type === 'password') return 'password'
  if (uiOptions?.type === 'textarea') return 'textarea'
  if (uiOptions?.type === 'select') return 'select'

  const unwrapped = unwrapZodType(schema)

  if (unwrapped instanceof z.ZodBoolean) return 'switch'
  if (unwrapped instanceof z.ZodNumber) return 'number'
  if (unwrapped instanceof z.ZodArray) return 'tags'
  if (isEnumLikeSchema(unwrapped)) return 'select'

  return 'input'
}

function getSelectOptions(
  schema: z.ZodTypeAny,
  meta: SchemaMetadata | undefined,
): Array<{ label: string; value: string | number }> | undefined {
  const uiOptions = meta?.['ui:options']
  if (uiOptions?.values) {
    return uiOptions.values
  }

  const unwrapped = unwrapZodType(schema)

  if (unwrapped instanceof z.ZodEnum) {
    return unwrapped.options
      .filter((v) => typeof v === 'string' || typeof v === 'number')
      .map((v) => ({ label: String(v), value: v }))
  }

  const enumObj = (unwrapped as any)?.enum
  if (enumObj && typeof enumObj === 'object') {
    return Object.entries(enumObj)
      .filter(([key]) => Number.isNaN(Number(key)))
      .filter(
        ([, value]) => typeof value === 'string' || typeof value === 'number',
      )
      .map(([key, value]) => ({ label: key, value: value as string | number }))
  }

  const options = (unwrapped as any)?.options
  if (Array.isArray(options)) {
    return options
      .filter((v: unknown) => typeof v === 'string' || typeof v === 'number')
      .map((v: string | number) => ({ label: String(v), value: v }))
  }

  return undefined
}

function isRequired(schema: z.ZodTypeAny): boolean {
  if (schema instanceof z.ZodOptional) return false
  if (schema instanceof z.ZodDefault) return false
  return true
}

// ==================== Field Extraction ====================

function extractField(key: string, schema: z.ZodTypeAny): FormField {
  const meta = getMeta(schema)
  const innerMeta =
    schema instanceof z.ZodOptional
      ? getMeta(schema.unwrap() as unknown as z.ZodTypeAny)
      : undefined
  const effectiveMeta = meta || innerMeta

  const uiOptions = effectiveMeta?.['ui:options']
  const component = inferUIComponent(schema, effectiveMeta)

  const field: FormField = {
    key,
    title: effectiveMeta?.title || key,
    ui: {
      component,
    },
  }

  if (effectiveMeta?.description) {
    field.description = effectiveMeta.description
  }

  if (isRequired(schema)) {
    field.required = true
  }

  if (uiOptions?.halfGrid) {
    field.ui.halfGrid = true
  }

  if (uiOptions?.type === 'hidden' || uiOptions?.hide) {
    field.ui.hidden = true
  }

  if (uiOptions?.showWhen) {
    field.ui.showWhen = uiOptions.showWhen
  }

  if (component === 'select') {
    const options = getSelectOptions(schema, effectiveMeta)
    if (options) {
      field.ui.options = options
    }
  }

  const unwrapped = unwrapZodType(schema)
  if (unwrapped instanceof z.ZodObject && component !== 'select') {
    const nestedFields = extractFields(unwrapped)
    if (nestedFields.length > 0) {
      field.fields = nestedFields
    }
  }

  return field
}

function extractFields(schema: z.ZodObject<any>): FormField[] {
  const shape = schema.shape
  const fields: FormField[] = []

  for (const [key, propSchema] of Object.entries(shape)) {
    const field = extractField(key, propSchema as z.ZodTypeAny)
    fields.push(field)
  }

  return fields
}

// ==================== Section Conversion ====================

export function zodToFormSection(
  schema: z.ZodTypeAny,
  sectionKey: string,
): FormSection {
  const meta = getMeta(schema)
  const uiOptions = meta?.['ui:options']

  const section: FormSection = {
    key: sectionKey,
    title: meta?.title || sectionKey,
    fields: [],
  }

  if (meta?.description) {
    section.description = meta.description
  }

  if (uiOptions?.type === 'hidden') {
    section.hidden = true
  }

  const unwrapped = unwrapZodType(schema)
  if (unwrapped instanceof z.ZodObject) {
    section.fields = extractFields(unwrapped)
  }

  return section
}

// ==================== Full DSL Generation ====================

export function generateFormDSL(): FormDSL {
  const fullMeta = getMeta(FullConfigSchema)

  // Build section map
  const sectionMap = new Map<string, FormSection>()
  for (const [key, schema] of Object.entries(configSchemaMapping)) {
    const section = zodToFormSection(schema, key)
    if (!section.hidden) {
      sectionMap.set(key, section)
    }
  }

  // Build groups
  const groups: FormGroup[] = []
  for (const groupConfig of groupConfigs) {
    const sections: FormSection[] = []
    for (const sectionKey of groupConfig.sectionKeys) {
      const section = sectionMap.get(sectionKey)
      if (section) {
        sections.push(section)
      }
    }

    if (sections.length > 0) {
      groups.push({
        key: groupConfig.key,
        title: groupConfig.title,
        description: groupConfig.description,
        icon: groupConfig.icon,
        sections,
      })
    }
  }

  const dsl: FormDSL = {
    title: fullMeta?.title || '设置',
    groups,
    defaults: {},
  }

  if (fullMeta?.description) {
    dsl.description = fullMeta.description
  }

  return dsl
}

// ==================== AI Provider Options Injection ====================

export interface AIProviderInfo {
  id: string
  name?: string
  type?: string
}

export function attachAiProviderOptionsToFormDSL(
  dsl: FormDSL,
  aiConfig: any,
): void {
  if (!aiConfig) return

  const providers: AIProviderInfo[] = Array.isArray(aiConfig.providers)
    ? aiConfig.providers
    : []

  const assignments = [
    aiConfig.summaryModel?.providerId,
    aiConfig.writerModel?.providerId,
    aiConfig.commentReviewModel?.providerId,
    aiConfig.translationModel?.providerId,
  ].filter(Boolean) as string[]

  const options: Array<{ label: string; value: string }> = []
  const seen = new Set<string>()

  const addOption = (id?: string, label?: string) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    options.push({ label: label || id, value: id })
  }

  for (const provider of providers) {
    addOption(provider.id, formatProviderLabel(provider))
  }

  for (const providerId of assignments) {
    addOption(providerId, providerId)
  }

  if (options.length === 0) return

  // Find AI group and section
  const aiGroup = dsl.groups.find((g) => g.key === 'ai')
  if (!aiGroup) return

  const aiSection = aiGroup.sections.find((s) => s.key === 'ai')
  if (!aiSection) return

  const providerIdFields = findProviderIdFields(aiSection.fields)
  for (const field of providerIdFields) {
    field.ui.component = 'select'
    field.ui.options = options
  }
}

function formatProviderLabel(provider: AIProviderInfo): string {
  const name = provider.name?.trim() || ''
  const type = provider.type || ''
  const id = provider.id || ''

  const nameLooksLikeUuid =
    !!name &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)

  const displayName = !nameLooksLikeUuid && name ? name : ''

  if (displayName && type) return `${displayName} (${type})`
  if (displayName) return displayName
  if (type) return type
  return id || 'Unknown'
}

function findProviderIdFields(fields: FormField[]): FormField[] {
  const matches: FormField[] = []

  const visit = (fieldList: FormField[]) => {
    for (const field of fieldList) {
      if (field.key === 'providerId' && field.title === 'Provider ID') {
        matches.push(field)
      }
      if (field.fields) {
        visit(field.fields)
      }
    }
  }

  visit(fields)
  return matches
}
