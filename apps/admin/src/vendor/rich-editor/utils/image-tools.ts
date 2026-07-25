import type { AgentToolConfig, AgentToolResult } from '@haklex/rich-agent-core'

import type { ImageAspectRatio } from '~/api/ai-image'
import { generateImage, waitForImageTask } from '~/api/ai-image'

const GENERATE_TOOL = 'generate_image'

const ASPECT_RATIOS: ImageAspectRatio[] = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
]

interface BuildImageToolsOptions {
  refId?: string
}

function toError(error: string, message: string): AgentToolResult {
  return { error: { error, message }, ok: false }
}

function isImageAspectRatio(value: unknown): value is ImageAspectRatio {
  return (
    typeof value === 'string' && (ASPECT_RATIOS as string[]).includes(value)
  )
}

export function buildImageTools({
  refId,
}: BuildImageToolsOptions = {}): AgentToolConfig[] {
  return [
    {
      name: GENERATE_TOOL,
      description:
        '根据文字描述生成一张图片，用于插入正文。生成完成后返回图片 URL；' +
        '拿到 URL 后需再调用 insert_node，用 <img src="URL" alt="..." /> 将图片插入文档，本工具本身不会修改文档。',
      parameters: {
        additionalProperties: false,
        properties: {
          aspectRatio: {
            description: '图片宽高比，省略则使用默认比例',
            enum: ASPECT_RATIOS,
            type: 'string',
          },
          prompt: {
            description: '图片内容的文字描述',
            type: 'string',
          },
        },
        required: ['prompt'],
        type: 'object',
      },
      execute: async (params: unknown): Promise<AgentToolResult> => {
        const prompt = (params as { prompt?: unknown } | null)?.prompt
        if (typeof prompt !== 'string' || !prompt.trim()) {
          return toError('invalid_params', 'prompt 必须为非空字符串')
        }

        const aspectRatioParam = (params as { aspectRatio?: unknown } | null)
          ?.aspectRatio
        const aspectRatio = isImageAspectRatio(aspectRatioParam)
          ? aspectRatioParam
          : undefined

        try {
          const { taskId } = await generateImage({
            aspectRatio,
            prompt: prompt.trim(),
            purpose: 'inline',
            refId,
            requestId: crypto.randomUUID(),
          })
          const result = await waitForImageTask(taskId)

          return {
            content: `Generated image ready at URL: ${result.url}\nTo insert it into the document, call insert_node with xml: <img src="${result.url}" alt="..." />.`,
            ok: true,
          }
        } catch (error) {
          return toError(
            'generate_failed',
            error instanceof Error ? error.message : String(error),
          )
        }
      },
      describeCall: (params: unknown) => {
        const prompt = (params as { prompt?: unknown } | null)?.prompt
        if (typeof prompt !== 'string' || !prompt) return `${GENERATE_TOOL}()`
        const preview = prompt.length > 40 ? `${prompt.slice(0, 40)}…` : prompt
        return `${GENERATE_TOOL}("${preview}")`
      },
    },
  ]
}
