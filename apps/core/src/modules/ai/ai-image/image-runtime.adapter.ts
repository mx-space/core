import { AppErrorCode, createAppException } from '~/common/errors'

import { defaultImageProtocolAdapterRegistry } from './image-protocol.registry'
import type {
  IImageRuntime,
  ImageGenerateOptions,
  ImageRuntimeAdapterConfig,
} from './image-runtime.interface'

export type { ImageRuntimeAdapterConfig } from './image-runtime.interface'

export class ImageRuntimeAdapter implements IImageRuntime {
  private readonly protocolAdapter: IImageRuntime

  constructor(config: ImageRuntimeAdapterConfig) {
    this.protocolAdapter = defaultImageProtocolAdapterRegistry.resolve(config)
  }

  async generateImage(
    opts: ImageGenerateOptions,
  ): Promise<Awaited<ReturnType<IImageRuntime['generateImage']>>> {
    try {
      return await this.protocolAdapter.generateImage(opts)
    } catch (error) {
      throw createAppException(AppErrorCode.IMAGE_GENERATION_FAILED, {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async listModels(): Promise<{ id: string; provider: string }[]> {
    return (await this.protocolAdapter.listModels?.()) ?? []
  }
}
