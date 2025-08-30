import { z } from '@mx-space/compiled/zod'
import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from 'ai'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'

@Injectable()
export class AiWriterService {
  private readonly logger: Logger
  constructor(private readonly aiService: AiService) {
    this.logger = new Logger(AiWriterService.name)
  }

  async generateTitleAndSlugByOpenAI(text: string) {
    const model = await this.aiService.getOpenAiModel()

    try {
      const { object } = await generateObject({
        model,
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
        temperature: 0.3, // Lower temperature for more consistent output
        maxRetries: 2, // Allow retries on failure
      })

      return object
    } catch (error) {
      this.logger.error(
        `Failed to generate title and slug: ${error.message}`,
        error.stack,
      )

      // Fallback response if AI fails
      const fallbackTitle =
        text.slice(0, 50).trim() + (text.length > 50 ? '...' : '')
      const fallbackSlug = fallbackTitle
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '')
        .slice(0, 50)

      return {
        title: fallbackTitle,
        slug: fallbackSlug || 'untitled',
        lang: 'en',
        keywords: [],
      }
    }
  }

  async generateSlugByTitleViaOpenAI(title: string) {
    const model = await this.aiService.getOpenAiModel()

    try {
      const { object } = await generateObject({
        model,
        schema: z.object({
          slug: z.string().describe(AI_PROMPTS.writer.slug.schema.slug),
        }),
        prompt: AI_PROMPTS.writer.slug.prompt(title),
        temperature: 0.3, // Lower temperature for more consistent output
        maxRetries: 2, // Allow retries on failure
      })

      return object
    } catch (error) {
      this.logger.error(
        `Failed to generate slug from title: ${error.message}`,
        error.stack,
      )

      // Fallback slug generation
      const fallbackSlug = title
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '')
        .slice(0, 50)

      return {
        slug: fallbackSlug || 'untitled',
      }
    }
  }
}
