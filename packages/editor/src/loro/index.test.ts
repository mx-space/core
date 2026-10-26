import { createLoroBinding } from '@haklex/rich-collab-loro'
import { allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $getState, $setState, createState } from 'lexical'
import { LoroDoc } from 'loro-crdt'
import { describe, expect, it } from 'vitest'

import { createContentDoc, editDocAt, readDocContent } from './index'

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
