import { toJSONSchema, type z } from 'zod'
import type { IModelRuntime } from './model-runtime.interface'
import type {
  GenerateStructuredOptions,
  GenerateStructuredResult,
  GenerateTextOptions,
  GenerateTextResult,
  ModelInfo,
  RuntimeProviderInfo,
} from './types'

export abstract class BaseRuntime implements IModelRuntime {
  abstract readonly providerInfo: RuntimeProviderInfo

  abstract generateText(
    options: GenerateTextOptions,
  ): Promise<GenerateTextResult>

  abstract generateStructured<T extends z.ZodType>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<z.infer<T>>>

  listModels?(): Promise<ModelInfo[]>

  protected zodToJsonSchema(schema: z.ZodType<any>): Record<string, unknown> {
    const jsonSchema = toJSONSchema(schema) as Record<string, unknown>
    // Remove $schema field for OpenAI compatibility
    delete jsonSchema.$schema
    return jsonSchema
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
  ): Promise<T> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          const delay = 2 ** attempt * 1000
          await this.sleep(delay)
        }
      }
    }
    throw lastError
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
