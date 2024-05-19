import { Injectable } from '@nestjs/common'
import OpenAI from 'openai'
import { fetch } from '@mx-space/external'
import { OpenAI as OpenAIChain } from '@langchain/openai'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { ConfigsService } from '../configs/configs.service'

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigsService) {}
  public async getOpenAiClient() {
    const {
      ai: { openAiEndpoint, openAiKey },
    } = await this.configService.waitForConfigReady()
    if (!openAiKey) {
      throw new BizException(ErrorCodeEnum.AINotEnabled, 'Key not found')
    }
    return new OpenAI({
      apiKey: openAiKey,
      baseURL: openAiEndpoint || void 0,
      // @ts-expect-error
      fetch: isDev ? fetch : void 0,
    })
  }

  public async getOpenAiChain() {
    const {
      ai: { openAiKey, openAiEndpoint, openAiPreferredModel },
    } = await this.configService.waitForConfigReady()
    if (!openAiKey) {
      throw new BizException(ErrorCodeEnum.AINotEnabled, 'Key not found')
    }
    return new OpenAIChain({
      openAIApiKey: openAiKey,
      model: openAiPreferredModel,
      configuration: {
        baseURL: openAiEndpoint || void 0,
      },
    })
  }
}
