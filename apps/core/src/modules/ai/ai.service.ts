import { createOpenAI } from '@ai-sdk/openai'
import { Injectable } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { ConfigsService } from '../configs/configs.service'

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigsService) {}

  public async getOpenAiProvider() {
    const {
      ai: { openAiKey, openAiEndpoint },
      url: { webUrl },
    } = await this.configService.waitForConfigReady()
    if (!openAiKey) {
      throw new BizException(ErrorCodeEnum.AINotEnabled, 'Key not found')
    }

    return createOpenAI({
      apiKey: openAiKey,
      baseURL: openAiEndpoint || undefined,
      headers: {
        'X-Title': 'Mix Space AI Client',
        'HTTP-Referer': webUrl,
      },
    })
  }

  public async getOpenAiModel() {
    const {
      ai: { openAiPreferredModel },
    } = await this.configService.waitForConfigReady()

    const provider = await this.getOpenAiProvider()
    return provider(openAiPreferredModel)
  }
}
