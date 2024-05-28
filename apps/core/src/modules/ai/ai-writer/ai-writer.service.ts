import { Injectable, Logger } from '@nestjs/common'

import { JsonOutputFunctionsParser } from 'langchain/output_parsers'
import { AiService } from '../ai.service'
import type { FunctionDefinition } from '@langchain/core/language_models/base'

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
            'The title of the article generated from the input text, the natural language of the title should be the same as the natural language of the input text',
        },
        slug: {
          type: 'string',
          description:
            'The slug is named after the text entered, and is in English and conforms to url specifications',
        },
        lang: {
          type: 'string',
          description: 'The natural language of the input text',
        },
      },
      required: ['title', 'slug', 'lang'],
    })
  }

  async generateSlugByTitleViaOpenAI(title: string) {
    return this.queryByFunctionSchema(title, {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'The slug is named after the text entered, and is in English and conforms to url specifications',
        },
      },
      required: ['slug'],
    })
  }
}
