import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import type { NoteRepository, NoteRow } from '~/modules/note/note.repository'
import { NoteService } from '~/modules/note/note.service'
import { ContentFormat } from '~/shared/types/content-format.type'

const createNote = (overrides: Partial<NoteRow> = {}): NoteRow => ({
  id: 'note-1' as any,
  nid: 1,
  title: 'Note',
  slug: 'note',
  text: 'body',
  content: null,
  contentFormat: ContentFormat.Markdown,
  images: [],
  meta: null,
  isPublished: true,
  hasPassword: false,
  publicAt: null,
  mood: null,
  weather: null,
  bookmark: false,
  coordinates: null,
  location: null,
  readCount: 0,
  likeCount: 0,
  topicId: null,
  topic: null,
  createdAt: now,
  modifiedAt: null,
  ...overrides,
})

const createService = () => {
  const repository = createPgRepositoryMock<NoteRepository>()
  const imageService = { saveImageDimensionsFromMarkdownText: vi.fn() }
  const fileReferenceService = {
    activateReferences: vi.fn(),
    removeReferencesForDocument: vi.fn(),
    updateReferencesForDocument: vi.fn(),
  }
  const eventManager = { emit: vi.fn() }
  const lexicalService = { normalizeContentForStorage: vi.fn() }
  const slugTrackerService = {
    createTracker: vi.fn(),
    findTrackerBySlug: vi.fn(),
    deleteAllTracker: vi.fn(),
  }
  const aiSlugBackfillService = {
    createBackfillTaskForNotes: vi.fn().mockResolvedValue(undefined),
  }
  const commentService = { deleteForRef: vi.fn() }
  const draftService = {
    linkToPublished: vi.fn(),
    markAsPublished: vi.fn(),
    deleteByRef: vi.fn(),
  }
  const enrichmentService = { scheduleDocPrefetch: vi.fn() }
  const service = new NoteService(
    repository as any,
    imageService as any,
    fileReferenceService as any,
    eventManager as any,
    lexicalService as any,
    slugTrackerService as any,
    aiSlugBackfillService as any,
    enrichmentService as any,
    commentService as any,
    draftService as any,
  )

  return {
    commentService,
    draftService,
    fileReferenceService,
    repository,
    service,
    slugTrackerService,
  }
}

describe('NoteService', () => {
  it('creates notes with database-generated nid and normalized slug', async () => {
    const { repository, service } = createService()
    repository.findBySlug.mockResolvedValue(null)
    repository.create.mockResolvedValue(createNote({ slug: 'hello' }))

    await service.create({
      nid: 42,
      title: 'Hello',
      slug: 'Hello!',
      text: 'body',
    } as any)

    const createInput = repository.create.mock.calls[0][0]
    expect(createInput).not.toHaveProperty('nid')
    expect(createInput).toEqual(
      expect.objectContaining({
        slug: 'hello',
        contentFormat: ContentFormat.Markdown,
      }),
    )
  })

  it('links a draft to the created note and removes draft file references', async () => {
    const { draftService, fileReferenceService, repository, service } =
      createService()
    repository.findBySlug.mockResolvedValue(null)
    repository.create.mockResolvedValue(createNote())

    await service.create({
      title: 'Note',
      text: 'body',
      draftId: 'draft-1',
    } as any)

    expect(
      fileReferenceService.removeReferencesForDocument,
    ).toHaveBeenCalledWith('draft-1', FileReferenceType.Draft)
    expect(draftService.linkToPublished).toHaveBeenCalledWith(
      'draft-1',
      'note-1',
    )
    expect(draftService.markAsPublished).toHaveBeenCalledWith('draft-1')
  })

  it('tracks SEO path changes when slug changes', async () => {
    const { repository, service, slugTrackerService } = createService()
    repository.findById.mockResolvedValue(createNote({ slug: 'old-note' }))
    repository.findBySlug.mockResolvedValue(null)
    repository.update.mockResolvedValue(createNote({ slug: 'new-note' }))

    await service.updateById('note-1', { slug: 'new note' } as any)

    expect(slugTrackerService.createTracker).toHaveBeenCalledWith(
      '/notes/2026/1/1/old-note',
      ArticleTypeEnum.Note,
      'note-1',
    )
    expect(repository.update).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({ slug: 'new-note' }),
    )
  })

  it('deletes note-related comments, drafts, file references, and slug trackers', async () => {
    const {
      commentService,
      draftService,
      fileReferenceService,
      repository,
      service,
      slugTrackerService,
    } = createService()
    repository.findById.mockResolvedValue(createNote())
    repository.deleteById.mockResolvedValue(createNote())

    await service.deleteById('note-1')

    expect(repository.deleteById).toHaveBeenCalledWith('note-1')
    expect(commentService.deleteForRef).toHaveBeenCalled()
    expect(draftService.deleteByRef).toHaveBeenCalledWith(
      DraftRefType.Note,
      'note-1',
    )
    expect(
      fileReferenceService.removeReferencesForDocument,
    ).toHaveBeenCalledWith('note-1', FileReferenceType.Note)
    expect(slugTrackerService.deleteAllTracker).toHaveBeenCalledWith('note-1')
  })
})
