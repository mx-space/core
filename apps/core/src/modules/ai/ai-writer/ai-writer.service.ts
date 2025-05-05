import type {
  FunctionDefinition,
  ToolDefinition,
} from '@langchain/core/language_models/base'

import { JsonOutputToolsParser } from '@langchain/core/output_parsers/openai_tools'
import { Injectable, Logger } from '@nestjs/common'

import { AiService } from '../ai.service'

@Injectable()
export class AiWriterService {
  private readonly logger: Logger
  constructor(private readonly aiService: AiService) {
    this.logger = new Logger(AiWriterService.name)
  }

  async queryByFunctionSchema(
    text: string,
    parameters: FunctionDefinition['parameters'],
  ) {
    const toolDefinition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'extractor',
        description: 'Extracts fields from the input.',
        parameters,
      },
    }
    const model = await this.aiService.getOpenAiChain()
    const parser = new JsonOutputToolsParser()

    const runnable = model
      .bind({
        tools: [toolDefinition],
        tool_choice: { type: 'function', function: { name: 'extractor' } },
      })
      .pipe(parser)
    const result = (await runnable.invoke([text])) as any[]

    if (result.length === 0) {
      return {}
    }
    // Extract just the args object from the first tool call response
    return result[0]?.args || {}
  }
  async generateTitleAndSlugByOpenAI(text: string) {
    return this.queryByFunctionSchema(text, {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description:
            'Generate a concise, engaging title from the input text. The title should be in the same language as the input text and capture the main topic effectively.',
        },
        slug: {
          type: 'string',
          description:
            'Create an SEO-friendly slug in English based on the title. The slug should be lowercase, use hyphens to separate words, contain only alphanumeric characters and hyphens, and include relevant keywords for better search engine ranking.',
        },
        lang: {
          type: 'string',
          description:
            'Identify the natural language of the input text (e.g., "en", "zh", "es", "fr", etc.).',
        },
        keywords: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'Extract 3-5 relevant keywords or key phrases from the input text that represent its main topics.',
        },
      },
      required: ['title', 'slug', 'lang', 'keywords'],
    })
  }

  async generateSlugByTitleViaOpenAI(title: string) {
    return this.queryByFunctionSchema(title, {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'An SEO-friendly slug in English based on the title. The slug should be lowercase, use hyphens to separate words, contain only alphanumeric characters and hyphens, and be concise while including relevant keywords from the title.',
        },
      },
      required: ['slug'],
    })
  }
}
