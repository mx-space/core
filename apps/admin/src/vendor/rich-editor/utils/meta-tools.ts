import type {
  AgentToolConfig,
  AgentToolResult,
  ChatMessage,
} from '@haklex/rich-agent-core'

export interface MetaFieldDescriptor {
  description: string
  enum?: readonly string[]
  example?: unknown
  type?: 'boolean' | 'number' | 'object' | 'string' | 'string[]'
}

export type MetaFieldsSchema = Record<string, MetaFieldDescriptor>

interface BuildMetaToolsOptions {
  getFields: () => Record<string, unknown>
  schema: MetaFieldsSchema
  setFields: (updates: Record<string, unknown>) => Promise<void> | void
}

const READ_TOOL = 'read_document_meta'
const UPDATE_TOOL = 'update_document_meta'

function jsonContent(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function toError(error: string, message: string): AgentToolResult {
  return { ok: false, error: { error, message } as any }
}

export function buildMetaTools({
  getFields,
  schema,
  setFields,
}: BuildMetaToolsOptions): AgentToolConfig[] {
  const allowedKeys = Object.keys(schema)

  return [
    {
      name: READ_TOOL,
      description:
        '读取当前文档除正文以外的元数据字段（标题、slug、标签、分类等）。可指定 keys 过滤；省略 keys 时返回全部字段。',
      parameters: {
        additionalProperties: false,
        properties: {
          keys: {
            description: `要读取的字段 key 数组。允许：${allowedKeys.join(', ')}。不传或空数组表示返回全部字段。`,
            items: { enum: allowedKeys, type: 'string' },
            type: 'array',
          },
        },
        type: 'object',
      },
      execute: async (params: unknown): Promise<AgentToolResult> => {
        const all = getFields()
        const requested = (() => {
          const keys = (params as any)?.keys
          if (Array.isArray(keys) && keys.length > 0) return keys as string[]
          return Object.keys(all)
        })()
        const data: Record<string, unknown> = {}
        const unknownKeys: string[] = []

        for (const key of requested) {
          if (key in all) data[key] = all[key]
          else unknownKeys.push(key)
        }

        return {
          ok: true,
          content: jsonContent({
            fields: data,
            ...(unknownKeys.length > 0 ? { unknownKeys } : {}),
          }),
        }
      },
      describeCall: (params: unknown) => {
        const keys = (params as any)?.keys
        return Array.isArray(keys) && keys.length > 0
          ? `${READ_TOOL}(${keys.join(', ')})`
          : `${READ_TOOL}(*)`
      },
    },
    {
      name: UPDATE_TOOL,
      description:
        '更新当前文档的元数据字段。以 key-value 对象传入，仅传需要修改的字段；未列出的字段保持不变。',
      parameters: {
        additionalProperties: false,
        properties: {
          updates: {
            additionalProperties: true,
            description: `要写入的字段 key-value 映射。允许字段：${allowedKeys.join(', ')}。`,
            type: 'object',
          },
        },
        required: ['updates'],
        type: 'object',
      },
      execute: async (params: unknown): Promise<AgentToolResult> => {
        const updates = (params as any)?.updates
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
          return toError('invalid_params', 'updates 必须为对象')
        }

        const accepted: Record<string, unknown> = {}
        const ignored: string[] = []
        for (const [key, value] of Object.entries(updates)) {
          if (key in schema) accepted[key] = value
          else ignored.push(key)
        }

        if (Object.keys(accepted).length === 0) {
          return toError(
            'no_writable_field',
            `无可写字段。允许：${allowedKeys.join(', ')}；已忽略：${ignored.join(', ') || '(空)'}`,
          )
        }

        try {
          await setFields(accepted)
        } catch (error) {
          return toError(
            'apply_failed',
            error instanceof Error ? error.message : String(error),
          )
        }

        return {
          ok: true,
          content: jsonContent({
            applied: accepted,
            ...(ignored.length > 0 ? { ignored } : {}),
          }),
        }
      },
      describeCall: (params: unknown) => {
        const updates = (params as any)?.updates ?? {}
        return `${UPDATE_TOOL}(${Object.keys(updates).join(', ') || '(空)'})`
      },
    },
  ]
}

export function buildMetaSystemMessages(
  schema: MetaFieldsSchema,
): ChatMessage[] {
  const keys = Object.keys(schema)
  if (keys.length === 0) return []

  const lines = keys.map((key) => {
    const descriptor = schema[key]
    const type = descriptor.type ? ` <${descriptor.type}>` : ''
    const enums = descriptor.enum?.length
      ? `（可选值：${descriptor.enum.join(' / ')}）`
      : ''
    const example =
      descriptor.example !== undefined
        ? `（示例：${jsonContent(descriptor.example)}）`
        : ''

    return `- \`${key}\`${type}: ${descriptor.description}${enums}${example}`
  })

  const content = [
    '当前文档除正文外还包含以下表单元数据字段，可通过工具读写：',
    ...lines,
    '',
    '工具调用规则：',
    `- \`${READ_TOOL}\`：读取字段。可传 keys 过滤，省略则返回全部。`,
    `- \`${UPDATE_TOOL}\`：以 \`{ updates: { key: value } }\` 形式写入；未列出的字段保持不变。`,
    '- 不确定当前值时，先读后写。',
    '- 仅在用户明确要求或正文修改自然涉及（如生成 slug/摘要）时才修改字段；不要主动改动 tags、分类等。',
  ].join('\n')

  return [{ content, role: 'system' }]
}
