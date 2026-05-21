import { describe, expect, it, vi } from 'vitest'

import { NoteController } from '~/modules/note/note.controller'

const createController = () => {
  const noteService = {
    create: vi.fn().mockResolvedValue({ id: 'note-1' }),
    updateById: vi.fn(),
    findOneByIdOrNid: vi.fn().mockResolvedValue({ id: 'note-1' }),
    deleteById: vi.fn(),
    publicNoteQueryCondition: { isPublished: true },
  }
  const controller = new NoteController(
    noteService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )
  return { controller, noteService }
}

describe('NoteController', () => {
  it('creates notes through the PG-backed NoteService', async () => {
    const { controller, noteService } = createController()

    await expect(
      controller.create({ title: 'Note', text: 'body' } as any),
    ).resolves.toEqual({ id: 'note-1' })
    expect(noteService.create).toHaveBeenCalledWith({
      title: 'Note',
      text: 'body',
    })
  })

  it('returns the refreshed note row after full modification', async () => {
    const { controller, noteService } = createController()

    await expect(
      controller.modify({ title: 'Updated' } as any, { id: 'note-1' }),
    ).resolves.toEqual({ id: 'note-1' })

    expect(noteService.updateById).toHaveBeenCalledWith('note-1', {
      title: 'Updated',
    })
    expect(noteService.findOneByIdOrNid).toHaveBeenCalledWith('note-1')
  })

  it('delegates publish status changes to NoteService updateById', async () => {
    const { controller, noteService } = createController()

    await expect(
      controller.setPublishStatus({ id: 'note-1' }, {
        isPublished: false,
      } as any),
    ).resolves.toEqual({ success: true })

    expect(noteService.updateById).toHaveBeenCalledWith('note-1', {
      isPublished: false,
    })
  })
})
