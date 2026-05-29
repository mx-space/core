import type {
  AssistantMessageEventStream,
  Static,
  TSchema,
} from '@earendil-works/pi-ai'

import type {
  GenerateStructuredOptions,
  GenerateStructuredResult,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateTextStreamOptions,
  ModelInfo,
  RuntimeProviderInfo,
  StreamMessageOptions,
  StructuredStreamChunk,
  TextStreamChunk,
} from './types'

export interface IModelRuntime {
  readonly providerInfo: RuntimeProviderInfo

  generateText: (options: GenerateTextOptions) => Promise<GenerateTextResult>
  generateTextStream?: (
    options: GenerateTextStreamOptions,
  ) => AsyncIterable<TextStreamChunk>

  generateStructured: <T extends TSchema>(
    options: GenerateStructuredOptions<T>,
  ) => Promise<GenerateStructuredResult<Static<T>>>

  streamStructured?: <T extends TSchema>(
    options: GenerateStructuredOptions<T>,
  ) => AsyncIterable<StructuredStreamChunk<Static<T>>>

  streamMessage?: (options: StreamMessageOptions) => AssistantMessageEventStream

  listModels?: () => Promise<ModelInfo[]>
}
