import type { z } from 'zod'
import type {
  GenerateStructuredOptions,
  GenerateStructuredResult,
  GenerateTextOptions,
  GenerateTextResult,
  ModelInfo,
  RuntimeProviderInfo,
} from './types'

export interface IModelRuntime {
  readonly providerInfo: RuntimeProviderInfo

  generateText: (options: GenerateTextOptions) => Promise<GenerateTextResult>

  generateStructured: <T extends z.ZodType>(
    options: GenerateStructuredOptions<T>,
  ) => Promise<GenerateStructuredResult<z.infer<T>>>

  listModels?: () => Promise<ModelInfo[]>
}
