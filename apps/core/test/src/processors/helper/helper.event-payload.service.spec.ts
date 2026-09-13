import { describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import { EventPayloadEnricherService } from '~/processors/helper/helper.event-payload.service'

describe('EventPayloadEnricherService republish', () => {
  const post = { id: 'post-1', title: 'Live', isPublished: true }
  const note = { id: 'note-1', title: 'Live note', nid: 7, isPublished: true }

  const createService = () => {
    const postService = { findById: vi.fn(async () => post) }
    const noteService = { findById: vi.fn(async () => note) }
    const pageService = { findById: vi.fn() }
    const readerService = { findReaderInIds: vi.fn() }
    const ownerService = { getOwner: vi.fn() }
    const service = new EventPayloadEnricherService(
      postService as never,
      noteService as never,
      pageService as never,
      readerService as never,
      ownerService as never,
    )
    return { noteService, postService, service }
  }

  it('loads the post document for POST_REPUBLISH', async () => {
    const { postService, service } = createService()
    await expect(
      service.enrichPayload(BusinessEvents.POST_REPUBLISH, { id: 'post-1' }),
    ).resolves.toEqual(post)
    expect(postService.findById).toHaveBeenCalledWith('post-1')
  })

  it('loads the note document for NOTE_REPUBLISH', async () => {
    const { noteService, service } = createService()
    await expect(
      service.enrichPayload(BusinessEvents.NOTE_REPUBLISH, { id: 'note-1' }),
    ).resolves.toEqual(note)
    expect(noteService.findById).toHaveBeenCalledWith('note-1')
  })
})
