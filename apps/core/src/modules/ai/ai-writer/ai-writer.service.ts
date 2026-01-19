import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { AI_FALLBACK_SLUG_MAX_LENGTH } from '../ai.constants'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'

@Injectable()
export class AiWriterService {
  private readonly logger: Logger
  constructor(private readonly aiService: AiService) {
    this.logger = new Logger(AiWriterService.name)
  }

  private generateFallbackSlug(text: string): string {
    const slug = text
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')
      .slice(0, AI_FALLBACK_SLUG_MAX_LENGTH)

    return slug || 'untitled'
  }

  async generateTitleAndSlugByOpenAI(text: string) {
    const model = await this.aiService.getWriterModel()

    try {
      const { object } = await generateObject({
        model: model as Parameters<typeof generateObject>[0]['model'],
        schema: z.object({
          title: z
            .string()
            .describe(AI_PROMPTS.writer.titleAndSlug.schema.title),
          slug: z.string().describe(AI_PROMPTS.writer.titleAndSlug.schema.slug),
          lang: z.string().describe(AI_PROMPTS.writer.titleAndSlug.schema.lang),
          keywords: z
            .array(z.string())
            .describe(AI_PROMPTS.writer.titleAndSlug.schema.keywords),
        }),
        prompt: AI_PROMPTS.writer.titleAndSlug.prompt(text),
        temperature: 0.3,
        maxRetries: 2,
      })

      return object
    } catch (error) {
      this.logger.error(
        `Failed to generate title and slug: ${error.message}`,
        error.stack,
      )

      const fallbackTitle =
        text.slice(0, AI_FALLBACK_SLUG_MAX_LENGTH).trim() +
        (text.length > AI_FALLBACK_SLUG_MAX_LENGTH ? '...' : '')

      return {
        title: fallbackTitle,
        slug: this.generateFallbackSlug(fallbackTitle),
        lang: 'en',
        keywords: [],
      }
    }
  }

  async generateSlugByTitleViaOpenAI(title: string) {
    const model = await this.aiService.getWriterModel()

    try {
      const { object } = await generateObject({
        model: model as Parameters<typeof generateObject>[0]['model'],
        schema: z.object({
          slug: z.string().describe(AI_PROMPTS.writer.slug.schema.slug),
        }),
        prompt: AI_PROMPTS.writer.slug.prompt(title),
        temperature: 0.3,
        maxRetries: 2,
      })

      return object
    } catch (error) {
      this.logger.error(
        `Failed to generate slug from title: ${error.message}`,
        error.stack,
      )

      return {
        slug: this.generateFallbackSlug(title),
      }
    }
  }
}
