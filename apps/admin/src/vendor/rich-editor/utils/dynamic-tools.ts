import type {
  AgentToolConfig,
  ToolCallGroupItem,
} from '@haklex/rich-agent-core'
import { $isDynamicNode } from '@haklex/rich-ext-dynamic'
import { isEqual } from 'es-toolkit'
import type { LexicalEditor } from 'lexical'
import { z } from 'zod'

import { $findBlockByBlockId } from './apply-agent-review-batch'

const targetSchema = z.object({
  blockId: z.string().min(1),
  url: z.url(),
  props: z.record(z.string(), z.json()),
  initialHeight: z.number(),
})

export function readDynamicTarget(editor: LexicalEditor, blockId: string) {
  return editor.getEditorState().read(() => {
    const node = $findBlockByBlockId(blockId)
    if (!$isDynamicNode(node))
      throw new Error('Component was removed or replaced')
    return targetSchema.parse({
      blockId,
      url: node.getUrl(),
      props: node.getProps(),
      initialHeight: node.getInitialHeight(),
    })
  })
}

export const DYNAMIC_PREVIEW_TOOL = 'preview_dynamic_component'

const draftSchema = z.object({
  target: targetSchema.optional(),
  name: z.string().trim().min(1).max(100),
  source: z.string().trim().min(1).max(200_000),
  props: z.record(z.string(), z.json()).default({}),
  initialHeight: z.number().int().min(80).max(2000).default(320),
})

export type DynamicDraft = z.infer<typeof draftSchema>

export function readDynamicDraft(item: ToolCallGroupItem): DynamicDraft | null {
  if (item.toolName !== DYNAMIC_PREVIEW_TOOL || item.status !== 'completed')
    return null
  try {
    const parsed = draftSchema.safeParse(JSON.parse(item.result ?? '{}').draft)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function readDynamicReceipt(item: ToolCallGroupItem): {
  url?: string
  inserted?: boolean
} {
  try {
    return z
      .object({ url: z.url().optional(), inserted: z.boolean().optional() })
      .parse(JSON.parse(item.result ?? '{}'))
  } catch {
    return {}
  }
}

export function buildDynamicTools(
  getEditor: () => LexicalEditor | null = () => null,
): AgentToolConfig[] {
  return [
    {
      name: DYNAMIC_PREVIEW_TOOL,
      description: `Create or revise an interactive JS component for the user to preview in this conversation. Supply the COMPLETE source on every revision; previous versions remain available. This tool does not upload or edit the article. The user must click Upload and insert to adopt it; do not insert a temporary URL yourself.
To edit a component already in the article, first call read_dynamic_component with its blockId from the document snapshot, then pass the returned target unchanged in every revision. Adoption replaces only that block in the current draft; a new URL is created and the published article keeps the old version until republished. Never edit or overwrite an uploaded file.
Source must be a standalone browser ES module (plain JavaScript, no JSX/TypeScript, npm/bare or relative imports). Prefer native DOM, CSS and SVG. Default export: { mount(container, { props, host: { theme } }) { /* render inside container */ return { update(input) { /* optional: props/theme changes */ }, unmount() { /* remove listeners, timers, animation frames and DOM */ } } }. mount is synchronous. Put styles INSIDE container: it lives in a Shadow DOM for CSS isolation. Do not modify document/head/body, use global CSS, or rely on admin libraries. Support light/dark theme and responsive width. Include accessible control labels. To fix an error or change the design, call this tool again with revised complete source.`,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          target: {
            type: 'object',
            description:
              'Exact target returned by read_dynamic_component, required when revising an existing article component',
            properties: {
              blockId: { type: 'string' },
              url: { type: 'string' },
              props: { type: 'object' },
              initialHeight: { type: 'number' },
            },
            required: ['blockId', 'url', 'props', 'initialHeight'],
          },
          name: { type: 'string', description: 'Short component title' },
          source: {
            type: 'string',
            description: 'Complete standalone ES module source',
          },
          props: {
            type: 'object',
            description: 'JSON input for the component',
          },
          initialHeight: { type: 'integer', minimum: 80, maximum: 2000 },
        },
        required: ['name', 'source'],
      },
      execute: async (params) => {
        const parsed = draftSchema.safeParse(params)
        if (!parsed.success)
          return {
            ok: false,
            error: { error: 'invalid_params', message: parsed.error.message },
          }
        if (parsed.data.target) {
          try {
            const editor = getEditor()
            if (
              !editor ||
              !isEqual(
                readDynamicTarget(editor, parsed.data.target.blockId),
                parsed.data.target,
              )
            )
              throw new Error(
                'Component changed; read it again before revising',
              )
          } catch (error) {
            return {
              ok: false,
              error: { error: 'stale_component', message: String(error) },
            }
          }
        }
        return {
          ok: true,
          content: JSON.stringify({
            // Keep the artifact in a JSON string: API envelope normalization
            // must not rename arbitrary keys inside component props.
            draft: parsed.data,
            message:
              'Draft ready for interactive preview. Not uploaded or inserted. Wait for the user to adopt it or request changes.',
          }),
        }
      },
      describeCall: (params) =>
        String((params as { name?: string })?.name ?? DYNAMIC_PREVIEW_TOOL),
    },
    {
      name: 'read_dynamic_component',
      description:
        'Read the current source and immutable version target of an embedded component. Use the blockId from the document snapshot. Pass the returned target unchanged to preview_dynamic_component when revising it.',
      parameters: {
        type: 'object',
        properties: { blockId: { type: 'string' } },
        required: ['blockId'],
        additionalProperties: false,
      },
      execute: async (params) => {
        try {
          const { blockId } = z
            .object({ blockId: z.string().min(1) })
            .parse(params)
          const editor = getEditor()
          if (!editor) throw new Error('Editor is unavailable')
          const target = readDynamicTarget(editor, blockId)
          const url = new URL(target.url)
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw new Error('Unsupported component URL')
          const response = await fetch(url, {
            credentials: 'omit',
            signal: AbortSignal.timeout(15000),
          })
          if (!response.ok)
            throw new Error(`Source request failed: ${response.status}`)
          const source = await response.text()
          if (source.length > 200_000)
            throw new Error('Component source is too large')
          if (
            getEditor() !== editor ||
            !isEqual(readDynamicTarget(editor, blockId), target)
          )
            throw new Error('Component changed while reading')
          return { ok: true, content: JSON.stringify({ target, source }) }
        } catch (error) {
          return {
            ok: false,
            error: { error: 'read_component_failed', message: String(error) },
          }
        }
      },
    },
  ]
}
