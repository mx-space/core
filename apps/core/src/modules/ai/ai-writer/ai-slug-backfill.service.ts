import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import slugify from 'slugify'

import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import { InjectModel } from '~/transformers/model.transformer'
import { createAbortError } from '~/utils/abort.util'

import { NoteModel } from '../../note/note.model'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  AITaskType,
  type SlugBackfillTaskPayload,
} from '../ai-task/ai-task.types'
import { AiWriterService } from './ai-writer.service'

@Injectable()
export class AiSlugBackfillService implements OnModuleInit {
  private readonly logger: Logger
  constructor(
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    private readonly aiWriterService: AiWriterService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly aiTaskService: AiTaskService,
  ) {
    this.logger = new Logger(AiSlugBackfillService.name)
  }

  onModuleInit() {
    this.registerTaskHandler()
  }

  private normalizeSlug(slug?: string | null) {
    if (!slug) return undefined
    const normalized = slugify(slug, { lower: true, strict: true, trim: true })
    return normalized || undefined
  }

  private async ensureSlugAvailable(slug: string): Promise<boolean> {
    const existing = await this.noteModel.findOne({ slug }).lean()
    return !existing
  }

  async getNotesWithoutSlugCount() {
    return this.noteModel.countDocuments({
      $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
    })
  }

  async getNotesWithoutSlug(limit = 0) {
    const query = this.noteModel
      .find({
        $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
      })
      .select('_id title nid')
      .sort({ created: -1 })

    if (limit > 0) {
      query.limit(limit)
    }

    return query.lean()
  }

  async createBackfillTask() {
    const count = await this.getNotesWithoutSlugCount()
    return this.aiTaskService.createSlugBackfillTask({
      noteCount: count,
    })
  }

  private registerTaskHandler() {
    this.taskProcessor.registerHandler({
      type: AITaskType.SlugBackfill,
      execute: async (
        _payload: SlugBackfillTaskPayload,
        context: TaskExecuteContext,
      ) => {
        const notes = await this.getNotesWithoutSlug()

        if (notes.length === 0) {
          await context.appendLog('info', 'No notes without slug found')
          return
        }

        await context.appendLog(
          'info',
          `Found ${notes.length} notes without slug`,
        )
        await context.updateProgress(0, `0/${notes.length}`)

        let processed = 0
        let skipped = 0

        for (const note of notes) {
          this.checkAborted(context)

          try {
            const result =
              await this.aiWriterService.generateSlugByTitleViaOpenAI(
                note.title,
              )
            const slug = this.normalizeSlug(result.slug)

            if (!slug) {
              skipped++
              await context.appendLog(
                'warn',
                `Skip nid:${note.nid} "${note.title}" — empty slug`,
              )
              continue
            }

            const available = await this.ensureSlugAvailable(slug)
            if (!available) {
              skipped++
              await context.appendLog(
                'warn',
                `Skip nid:${note.nid} "${note.title}" — slug "${slug}" conflict`,
              )
              continue
            }

            const updated = await this.noteModel.updateOne(
              {
                _id: note._id,
                $or: [
                  { slug: { $exists: false } },
                  { slug: null },
                  { slug: '' },
                ],
              },
              { $set: { slug } },
            )

            if (updated.modifiedCount === 0) {
              skipped++
              await context.appendLog(
                'warn',
                `Skip nid:${note.nid} "${note.title}" — slug already set`,
              )
              continue
            }

            processed++
            await context.appendLog(
              'info',
              `nid:${note.nid} "${note.title}" → "${slug}"`,
            )
          } catch (error) {
            skipped++
            this.logger.error(
              `Failed to generate slug for note ${note.nid}: ${error.message}`,
            )
            await context.appendLog(
              'error',
              `nid:${note.nid} "${note.title}" — ${error.message}`,
            )
          }

          const progress = ((processed + skipped) / notes.length) * 100
          await context.updateProgress(
            progress,
            `${processed + skipped}/${notes.length}`,
          )
        }

        await context.appendLog(
          'info',
          `Done: ${processed} processed, ${skipped} skipped, ${notes.length} total`,
        )
      },
    })
  }

  private checkAborted(context: TaskExecuteContext) {
    if (context.isAborted()) {
      throw createAbortError()
    }
  }
}
