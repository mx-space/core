import { describe, expect, it } from 'vitest'

import { DraftRefType } from '~/modules/draft/draft.enum'
import {
  CreateDraftSchema,
  UpdateDraftSchema,
} from '~/modules/draft/draft.schema'
import { NoteSchema, PartialNoteSchema } from '~/modules/note/note.schema'
import { ContentFormat } from '~/shared/types/content-format.type'

const lexicalContent = JSON.stringify({
  root: { children: [], type: 'root', version: 1 },
})

describe('lexical content/text pair validation', () => {
  it('accepts lexical create payloads with content and text', () => {
    expect(() =>
      NoteSchema.parse({
        content: lexicalContent,
        contentFormat: ContentFormat.Lexical,
        text: '',
        title: 'Note',
      }),
    ).not.toThrow()
  })

  it('rejects lexical create payloads without content', () => {
    expect(() =>
      NoteSchema.parse({
        contentFormat: ContentFormat.Lexical,
        text: 'projection',
        title: 'Note',
      }),
    ).toThrow(/content is required/)
  })

  it('rejects lexical partial updates when content and text are not paired', () => {
    expect(() =>
      PartialNoteSchema.parse({
        content: lexicalContent,
        contentFormat: ContentFormat.Lexical,
      }),
    ).toThrow(/content and text must be submitted together/)
  })

  it('allows markdown partial updates with text only', () => {
    expect(() =>
      PartialNoteSchema.parse({
        contentFormat: ContentFormat.Markdown,
        text: '# markdown',
      }),
    ).not.toThrow()
  })

  it('applies the same lexical pair rule to draft create and update', () => {
    expect(() =>
      CreateDraftSchema.parse({
        content: lexicalContent,
        contentFormat: ContentFormat.Lexical,
        refType: DraftRefType.Note,
        text: '',
      }),
    ).not.toThrow()

    expect(() =>
      UpdateDraftSchema.parse({
        content: lexicalContent,
        contentFormat: ContentFormat.Lexical,
      }),
    ).toThrow(/content and text must be submitted together/)
  })
})
