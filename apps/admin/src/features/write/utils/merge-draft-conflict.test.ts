import { describe, expect, it } from 'vitest'

import type { DraftWriteData } from '~/api/drafts'
import type { DraftModel, RevisionSnapshot } from '~/models/draft'
import { DraftRefType } from '~/models/draft'

import { mergeDraftConflict } from './merge-draft-conflict'

const paragraph = (blockId: string, text: string) => ({
  $: { blockId },
  children: [
    {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text,
      type: 'text',
      version: 1,
    },
  ],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})

const lexical = (...children: ReturnType<typeof paragraph>[]) =>
  JSON.stringify({
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })

const createdAt = '2026-01-01T00:00:00.000Z'
const createDraft = (
  overrides: Partial<RevisionSnapshot> & { version?: number } = {},
): DraftModel => {
  const { version = 1, ...snapshot } = overrides
  const revision = {
    content: null,
    contentFormat: 'markdown' as const,
    createdAt,
    documentId: 'document-1',
    id: `revision-${version}`,
    images: null,
    meta: null,
    parentRevisionId: version === 1 ? null : 'revision-1',
    text: 'base text',
    title: 'Base title',
    typeSpecificData: null,
    ...snapshot,
  }
  return {
    baseRevision: revision,
    baseRevisionId: 'revision-1',
    commonAncestorRevisionId: 'revision-1',
    createdAt,
    document: {
      createdAt,
      id: 'document-1',
      publishedRevisionId: 'revision-1',
      refId: 'post-1',
      refType: DraftRefType.Post,
      updatedAt: createdAt,
    },
    documentId: 'document-1',
    headRevision: revision,
    headRevisionId: revision.id,
    id: 'draft-1',
    publishedRevision: null,
    relationToPublished: version === 1 ? 'same' : 'ancestor',
    status: 'active',
    updatedAt: createdAt,
  }
}

const toLocal = (draft: DraftModel): DraftWriteData => ({
  content: draft.headRevision.content ?? undefined,
  contentFormat: draft.headRevision.contentFormat,
  images: draft.headRevision.images,
  meta: draft.headRevision.meta,
  text: draft.headRevision.text,
  title: draft.headRevision.title,
  typeSpecificData: draft.headRevision.typeSpecificData,
})

describe('mergeDraftConflict', () => {
  it('merges independent field changes without a conflict', () => {
    const base = createDraft({ meta: { summary: 'base' } })
    const local = { ...toLocal(base), title: 'Local title' }
    const remote = createDraft({
      meta: { summary: 'remote' },
      version: 2,
    })

    const result = mergeDraftConflict({ base, local, remote })

    expect(result.conflicts).toEqual([])
    expect(result.data.title).toBe('Local title')
    expect(result.data.meta).toEqual({ summary: 'remote' })
  })

  it('recursively merges changes to different metadata keys', () => {
    const base = createDraft({
      meta: {
        seo: { description: 'base', keywords: ['one'] },
      },
    })
    const local = {
      ...toLocal(base),
      meta: {
        seo: { description: 'local', keywords: ['one'] },
      },
    }
    const remote = createDraft({
      meta: {
        seo: { description: 'base', keywords: ['one', 'two'] },
      },
      version: 2,
    })

    const result = mergeDraftConflict({ base, local, remote })

    expect(result.conflicts).toEqual([])
    expect(result.data.meta).toEqual({
      seo: { description: 'local', keywords: ['one', 'two'] },
    })
  })

  it('merges non-overlapping markdown edits', () => {
    const base = createDraft({ text: 'hello world' })
    const local = { ...toLocal(base), text: 'hello brave world' }
    const remote = createDraft({ text: 'hello world!', version: 2 })

    const result = mergeDraftConflict({ base, local, remote })

    expect(result.conflicts).toEqual([])
    expect(result.data.text).toBe('hello brave world!')
  })

  it('reports overlapping markdown edits and preserves the local value', () => {
    const base = createDraft({ text: 'hello world' })
    const local = { ...toLocal(base), text: 'hello local' }
    const remote = createDraft({ text: 'hello remote', version: 2 })

    const result = mergeDraftConflict({ base, local, remote })

    expect(result.data.text).toBe('hello local')
    expect(result.conflicts).toEqual([
      expect.objectContaining({ kind: 'text', path: 'text' }),
    ])
  })

  it('merges changes to different Lexical blocks', () => {
    const base = createDraft({
      content: lexical(paragraph('a', 'A'), paragraph('b', 'B')),
      contentFormat: 'lexical',
      text: 'A\n\nB',
    })
    const local = {
      ...toLocal(base),
      content: lexical(paragraph('a', 'A local'), paragraph('b', 'B')),
      text: 'A local\n\nB',
    }
    const remote = createDraft({
      content: lexical(paragraph('a', 'A'), paragraph('b', 'B remote')),
      contentFormat: 'lexical',
      text: 'A\n\nB remote',
      version: 2,
    })

    const result = mergeDraftConflict({ base, local, remote })
    const merged = JSON.parse(result.data.content!)

    expect(result.conflicts).toEqual([])
    expect(merged.root.children[0].children[0].text).toBe('A local')
    expect(merged.root.children[1].children[0].text).toBe('B remote')
  })

  it('preserves blocks concurrently inserted by both writers', () => {
    const base = createDraft({
      content: lexical(paragraph('a', 'A')),
      contentFormat: 'lexical',
      text: 'A',
    })
    const local = {
      ...toLocal(base),
      content: lexical(paragraph('a', 'A'), paragraph('local', 'Local')),
      text: 'A\n\nLocal',
    }
    const remote = createDraft({
      content: lexical(paragraph('a', 'A'), paragraph('remote', 'Remote')),
      contentFormat: 'lexical',
      text: 'A\n\nRemote',
      version: 2,
    })

    const result = mergeDraftConflict({ base, local, remote })
    const merged = JSON.parse(result.data.content!)

    expect(result.conflicts).toEqual([])
    expect(
      merged.root.children.map(
        (node: ReturnType<typeof paragraph>) => node.$.blockId,
      ),
    ).toEqual(['a', 'local', 'remote'])
  })

  it('reports competing edits to the same Lexical block', () => {
    const base = createDraft({
      content: lexical(paragraph('a', 'A')),
      contentFormat: 'lexical',
      text: 'A',
    })
    const local = {
      ...toLocal(base),
      content: lexical(paragraph('a', 'A local')),
      text: 'A local',
    }
    const remote = createDraft({
      content: lexical(paragraph('a', 'A remote')),
      contentFormat: 'lexical',
      text: 'A remote',
      version: 2,
    })

    const result = mergeDraftConflict({ base, local, remote })

    expect(result.conflicts).toEqual([
      expect.objectContaining({
        kind: 'block',
        path: 'content.blocks.a',
      }),
    ])
    expect(
      JSON.parse(result.data.content!).root.children[0].children[0].text,
    ).toBe('A local')
  })

  it('does not silently delete a remotely edited block', () => {
    const base = createDraft({
      content: lexical(paragraph('a', 'A'), paragraph('b', 'B')),
      contentFormat: 'lexical',
      text: 'A\n\nB',
    })
    const local = {
      ...toLocal(base),
      content: lexical(paragraph('a', 'A')),
      text: 'A',
    }
    const remote = createDraft({
      content: lexical(paragraph('a', 'A'), paragraph('b', 'B remote')),
      contentFormat: 'lexical',
      text: 'A\n\nB remote',
      version: 2,
    })

    const result = mergeDraftConflict({ base, local, remote })

    expect(result.conflicts).toEqual([
      expect.objectContaining({
        kind: 'delete-edit',
        path: 'content.blocks.b',
      }),
    ])
  })
})
