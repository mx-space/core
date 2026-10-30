import { createLoroBinding } from '@haklex/rich-collab-loro'
import { allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $getState, $setState, createState } from 'lexical'
import { LoroDoc } from 'loro-crdt'
import { describe, expect, it } from 'vitest'

import {
  caretAtBlock,
  createContentDoc,
  editDocAt,
  editDocFields,
  readDocContent,
  vetUpdate,
} from './index'

const clientBlockId = createState('blockId', {
  parse: (value: unknown) => (typeof value === 'string' ? value : ''),
})

const paragraph = (value: string, blockId?: string) => ({
  children: [
    {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text: value,
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
  ...(blockId ? { $: { blockId } } : {}),
})

const state = (...children: object[]) =>
  JSON.stringify({
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })

const blocks = (doc: LoroDoc) =>
  (
    JSON.parse(readDocContent(doc).content) as {
      root: {
        children: {
          $?: { blockId?: string }
          children?: { text: string }[]
          type: string
        }[]
      }
    }
  ).root.children.map((child) => ({
    id: child.$?.blockId,
    text: child.children?.map((leaf) => leaf.text).join('') ?? child.type,
  }))

const loadInClient = (doc: LoroDoc) => {
  const tab = new LoroDoc()
  tab.import(doc.export({ mode: 'snapshot' }))
  const from = tab.oplogVersion()
  const editor = createHeadlessEditor({
    nodes: allHeadlessNodes,
    onError: (error) => {
      throw error
    },
  })
  const binding = createLoroBinding(editor, tab)
  editor.update(
    () => {
      const used = new Set<string>()
      for (const child of $getRoot().getChildren()) {
        let id = $getState(child, clientBlockId)
        if (!id || used.has(id)) {
          id = `client-${used.size}`
          $setState(child, clientBlockId, id)
        }
        used.add(id)
      }
    },
    { discrete: true },
  )
  binding.dispose()
  return tab.oplogVersion().compare(from)
}

describe('block ids in the Loro doc', () => {
  it('gives every root child a unique id when content is imported', () => {
    const map = { type: 'map', version: 1, lat: 1, lng: 2, zoom: 3 }
    const doc = createContentDoc(
      {
        content: state(
          paragraph('a'),
          paragraph('b', 'dup'),
          paragraph('c', 'dup'),
          map,
        ),
        title: 'T',
      },
      'import 1',
    )

    const read = blocks(doc)

    expect(read.map((block) => block.text)).toEqual(['a', 'b', 'c', 'map'])
    expect(read[1].id).toBe('dup')
    expect(read.every((block) => block.id?.length)).toBe(true)
    expect(new Set(read.map((block) => block.id)).size).toBe(read.length)
  })

  it('lets an editor load the imported doc without emitting an op', () => {
    const doc = createContentDoc(
      { content: state(paragraph('a'), paragraph('b')), title: 'T' },
      'import 1',
    )

    expect(loadInClient(doc)).toBe(0)
  })

  it('keeps ids of kept blocks and mints new ones when a target has none', () => {
    const doc = createContentDoc(
      { content: state(paragraph('a'), paragraph('b')), title: 'T' },
      'import 1',
    )
    const before = blocks(doc)

    doc.import(
      editDocAt(
        doc,
        doc.frontiers(),
        {
          content: state(paragraph('a'), paragraph('b2'), paragraph('new')),
          title: 'T',
        },
        'restore 1',
      ),
    )
    const after = blocks(doc)

    expect(after.map((block) => block.text)).toEqual(['a', 'b2', 'new'])
    expect(after[0].id).toBe(before[0].id)
    expect(after[1].id).toBe(before[1].id)
    expect(after[2].id).toBeTruthy()
    expect(new Set(after.map((block) => block.id)).size).toBe(3)
    expect(loadInClient(doc)).toBe(0)
  })

  it('writes nothing when a target without ids matches the doc', () => {
    const doc = createContentDoc(
      { content: state(paragraph('a'), paragraph('b')), title: 'T' },
      'import 1',
    )
    const version = doc.oplogVersion()

    doc.import(
      editDocAt(
        doc,
        doc.frontiers(),
        { content: state(paragraph('a'), paragraph('b')), title: 'T' },
        'legacy-save 1',
      ),
    )

    expect(doc.oplogVersion().compare(version)).toBe(0)
  })
})

describe('draft fields in the Loro doc', () => {
  const content = state(paragraph('body'))
  const fields = {
    meta: { aiGen: [0, 8], paywall: { previewBlocks: 3 } },
    typeSpecificData: { slug: 'hello', tags: ['a', 'b'], password: 'secret' },
  }

  it('round-trips fields written at creation, without secret keys', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    expect(readDocContent(doc).fields).toEqual({
      meta: { aiGen: [0, 8], paywall: { previewBlocks: 3 } },
      typeSpecificData: { slug: 'hello', tags: ['a', 'b'] },
    })
  })

  it('reports no fields for a doc that never had any', () => {
    const doc = createContentDoc({ content, title: 'T' }, 'init')
    expect(readDocContent(doc).fields).toBeUndefined()
  })

  it('leaves fields untouched when a target carries none', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    doc.import(
      editDocAt(doc, doc.frontiers(), { content, title: 'T2' }, 'title'),
    )
    expect(readDocContent(doc).fields?.typeSpecificData).toEqual({
      slug: 'hello',
      tags: ['a', 'b'],
    })
  })

  it('merges concurrent edits to different keys', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    const base = doc.frontiers()
    const left = editDocFields(
      doc,
      base,
      { typeSpecificData: { slug: 'left' } },
      'l',
      { peer: '11' },
    )
    const right = editDocFields(doc, base, { meta: { aiGen: [-1] } }, 'r', {
      peer: '22',
    })
    doc.import(left)
    doc.import(right)
    expect(readDocContent(doc).fields).toEqual({
      meta: { aiGen: [-1], paywall: { previewBlocks: 3 } },
      typeSpecificData: { slug: 'left', tags: ['a', 'b'] },
    })
  })

  it('keeps tags added concurrently on two peers', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    const base = doc.frontiers()
    const left = editDocAt(
      doc,
      base,
      {
        content,
        title: 'T',
        fields: {
          ...fields,
          typeSpecificData: { slug: 'hello', tags: ['a', 'b', 'c'] },
        },
      },
      'l',
      { peer: '11' },
    )
    const right = editDocAt(
      doc,
      base,
      {
        content,
        title: 'T',
        fields: {
          ...fields,
          typeSpecificData: { slug: 'hello', tags: ['z', 'a', 'b'] },
        },
      },
      'r',
      { peer: '22' },
    )
    doc.import(left)
    doc.import(right)
    const tags = readDocContent(doc).fields?.typeSpecificData?.tags as string[]
    expect([...tags].sort()).toEqual(['a', 'b', 'c', 'z'])
  })

  it('deletes a key patched to null and never writes a secret key', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    doc.import(
      editDocFields(
        doc,
        doc.frontiers(),
        { typeSpecificData: { tags: null, password: 'other' } },
        'patch',
      ),
    )
    expect(readDocContent(doc).fields?.typeSpecificData).toEqual({
      slug: 'hello',
    })
  })

  it('writes nothing when the fields already match', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    const version = doc.oplogVersion()
    doc.import(
      editDocAt(doc, doc.frontiers(), { content, title: 'T', fields }, 'same'),
    )
    expect(doc.oplogVersion().compare(version)).toBe(0)
  })
})

describe('vetUpdate with forbidFields', () => {
  const content = state(paragraph('body'))
  const fields = { meta: null, typeSpecificData: { slug: 'hello' } }

  it('refuses an update that changes draft fields', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    const update = editDocFields(
      doc,
      doc.frontiers(),
      { typeSpecificData: { slug: 'x' } },
      'human:r1',
    )
    expect(() =>
      vetUpdate(doc, update, { author: 'human:r1', forbidFields: true }),
    ).toThrowError(/fields/)
  })

  it('accepts a body-only update', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    const update = editDocAt(
      doc,
      doc.frontiers(),
      { content: state(paragraph('new')), title: 'T' },
      'human:r1',
    )
    expect(() =>
      vetUpdate(doc, update, { author: 'human:r1', forbidFields: true }),
    ).not.toThrow()
  })

  it('accepts a field change when fields are not forbidden', () => {
    const doc = createContentDoc({ content, title: 'T', fields }, 'init')
    const update = editDocFields(
      doc,
      doc.frontiers(),
      { typeSpecificData: { slug: 'x' } },
      'agent:x',
    )
    expect(() => vetUpdate(doc, update)).not.toThrow()
  })
})

describe('caretAtBlock', () => {
  it('points at the end of the last text in the block', () => {
    const doc = createContentDoc(
      {
        content: state(paragraph('one', 'b1'), paragraph('two words', 'b2')),
        title: 'T',
      },
      'init',
    )
    const caret = caretAtBlock(doc, 'b2')
    expect(caret?.offset).toBe('two words'.length)
    expect(typeof caret?.id).toBe('string')
  })

  it('returns null for an unknown block', () => {
    const doc = createContentDoc(
      { content: state(paragraph('one', 'b1')), title: 'T' },
      'init',
    )
    expect(caretAtBlock(doc, 'missing')).toBeNull()
  })
})
