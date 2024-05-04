import { Injectable, Logger } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'
import { safeJSONParse } from '~/utils'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { AiService } from '../ai.service'

@Injectable()
export class AiWriterService {
  private readonly logger: Logger
  constructor(
    private readonly configService: ConfigsService,

    private readonly aiService: AiService,
  ) {
    this.logger = new Logger(AiWriterService.name)
  }

  async queryOpenAI(prompt: string): Promise<any> {
    const openai = await this.aiService.getOpenAiClient()
    const { openAiPreferredModel } = await this.configService.get('ai')
    const result = await openai.chat.completions.create({
      model: openAiPreferredModel,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = result.choices[0].message.content || ''
    this.logger.log(
      `查询 OpenAI 返回结果：${content} 花费了 ${result.usage?.total_tokens} 个 token`,
    )

    const json = safeJSONParse(content)
    if (!json) {
      throw new BizException(ErrorCodeEnum.AIResultParsingError)
    }
    return json
  }

  async generateTitleAndSlugByOpenAI(text: string) {
    return this
      .queryOpenAI(`Please give the following text a title in the same language as the text and a slug in English, the output format is JSON. {title:string, slug:string}:
"${text}"

RESULT:`)
  }

  async generateSlugByTitleViaOpenAI(title: string) {
    return this
      .queryOpenAI(`Please give the following title a slug in English, the output format is JSON. {slug:string}:
      "${title}"

RESULT:`)
  }
}
