import type {
  AssistantMessageEventStream,
  Static,
  TSchema,
} from '@earendil-works/pi-ai'
import type { z } from 'zod'

import type {
  GenerateStructuredOptions,
  GenerateStructuredOptionsZod,
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

  /* eslint-disable @typescript-eslint/method-signature-style */
  /** @deprecated Zod-typed overload; removed in step-7 once all call sites migrate to TypeBox. */
  generateStructured<Z extends z.ZodType>(
    options: GenerateStructuredOptionsZod<Z>,
  ): Promise<GenerateStructuredResult<z.infer<Z>>>
  generateStructured<T extends TSchema>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<Static<T>>>
  /* eslint-enable @typescript-eslint/method-signature-style */

  streamStructured?: <T extends TSchema>(
    options: GenerateStructuredOptions<T>,
  ) => AsyncIterable<StructuredStreamChunk<Static<T>>>

  streamMessage?: (options: StreamMessageOptions) => AssistantMessageEventStream

  listModels?: () => Promise<ModelInfo[]>
}
