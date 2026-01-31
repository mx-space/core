import type { z } from 'zod'
import type {
  GenerateStructuredOptions,
  GenerateStructuredResult,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateTextStreamOptions,
  ModelInfo,
  RuntimeProviderInfo,
  TextStreamChunk,
} from './types'

export interface IModelRuntime {
  readonly providerInfo: RuntimeProviderInfo

  generateText: (options: GenerateTextOptions) => Promise<GenerateTextResult>
  generateTextStream?: (
    options: GenerateTextStreamOptions,
  ) => AsyncIterable<TextStreamChunk>

  generateStructured: <T extends z.ZodType>(
    options: GenerateStructuredOptions<T>,
  ) => Promise<GenerateStructuredResult<z.infer<T>>>

  listModels?: () => Promise<ModelInfo[]>
}
