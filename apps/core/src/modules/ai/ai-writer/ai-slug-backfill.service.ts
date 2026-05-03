import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import slugify from 'slugify'

import { NOTE_SERVICE_TOKEN } from '~/constants/injection.constant'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import { createAbortError } from '~/utils/abort.util'

import type { NoteService } from '../../note/note.service'
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
    @Inject(NOTE_SERVICE_TOKEN)
    private readonly noteService: NoteService,
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
    const existing = await this.noteService.findBySlug(slug)
    return !existing
  }

  async getNotesWithoutSlugCount() {
    return (await this.getNotesWithoutSlug()).length
  }

  async getNotesWithoutSlug(limit = 0) {
    const notes = (await this.noteService.findRecent(limit > 0 ? limit : 100))
      .filter((note) => !note.slug)
      .map((note) => ({
        id: note.id,
        title: note.title,
        nid: note.nid,
      }))
    return limit > 0 ? notes.slice(0, limit) : notes
  }

  async createBackfillTask() {
    const count = await this.getNotesWithoutSlugCount()
    return this.aiTaskService.createSlugBackfillTask({
      noteCount: count,
    })
  }

  async createBackfillTaskForNotes(noteIds: string[]) {
    const uniqueNoteIds = [...new Set(noteIds)].filter(Boolean)
    if (!uniqueNoteIds.length) {
      return { taskId: '', created: false }
    }

    return this.aiTaskService.createSlugBackfillTask({
      noteIds: uniqueNoteIds,
      noteCount: uniqueNoteIds.length,
    })
  }

  private getSluglessQuery(noteIds?: string[]) {
    return noteIds
  }

  private describeBackfillScope(payload: SlugBackfillTaskPayload) {
    if (payload.noteIds?.length) {
      return `Backfill scope: targeted notes (${payload.noteIds.length}) ids=${payload.noteIds.join(', ')}`
    }

    return 'Backfill scope: all notes without slug'
  }

  private registerTaskHandler() {
    this.taskProcessor.registerHandler({
      type: AITaskType.SlugBackfill,
      execute: async (
        payload: SlugBackfillTaskPayload,
        context: TaskExecuteContext,
      ) => {
        await context.appendLog('info', this.describeBackfillScope(payload))

        const queryIds = this.getSluglessQuery(payload.noteIds)
        const notes = queryIds?.length
          ? (await this.noteService.findManyByIds(queryIds)).filter(
              (note) => !note.slug,
            )
          : await this.getNotesWithoutSlug()

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

            const updated = await this.noteService.updateById(note.id, {
              slug,
            } as any)
            if (!updated) {
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
