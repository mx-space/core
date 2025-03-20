import { JsonOutputFunctionsParser } from 'langchain/output_parsers'
import type { FunctionDefinition } from '@langchain/core/language_models/base'

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
    const functionSchema: FunctionDefinition = {
      name: 'extractor',
      description: 'Extracts fields from the input.',
      parameters,
    }
    const model = await this.aiService.getOpenAiChain()
    const parser = new JsonOutputFunctionsParser()

    const runnable = model
      .bind({
        functions: [functionSchema],
        function_call: { name: 'extractor' },
      })
      .pipe(parser)
    const result = await runnable.invoke([text])

    return result
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
