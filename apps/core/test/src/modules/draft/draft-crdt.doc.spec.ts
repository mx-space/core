import { LoroDoc } from 'loro-crdt'
import { describe, expect, it } from 'vitest'

import {
  createContentDoc,
  editDocAt,
  readDocContent,
  revertChange,
  vetUpdate,
} from '~/modules/draft/draft-crdt.doc'

const text = (value: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
})

const paragraph = (value: string) => ({
  children: [text(value)],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
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

const texts = (content: string) =>
  (
    JSON.parse(content) as {
      root: { children: { children?: { text?: string }[]; type: string }[] }
    }
  ).root.children.map((child) =>
    child.children
      ? child.children.map((leaf) => leaf.text).join('')
      : child.type,
  )

describe('draft CRDT document', () => {
  it('round-trips title and body, keeping blocks the headless set does not know', () => {
    const map = { type: 'map', version: 1, lat: 1, lng: 2, zoom: 3 }
    const mystery = { type: 'mystery-block', version: 1, payload: { a: [1] } }
    const doc = createContentDoc(
      { content: state(paragraph('Hello'), map, mystery), title: 'Title' },
      'import 1',
    )

    const read = readDocContent(doc)
    const children = JSON.parse(read.content).root.children

    expect(read.title).toBe('Title')
    expect(texts(read.content)).toEqual(['Hello', 'map', 'mystery-block'])
    expect(children[1]).toMatchObject(map)
    expect(children[2]).toMatchObject(mystery)
  })

  it('keeps block ids and nested lists through the tree', () => {
    const list = {
      children: [
        {
          children: [text('item')],
          direction: null,
          format: '',
          indent: 0,
          type: 'listitem',
          value: 1,
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      listType: 'bullet',
      start: 1,
      tag: 'ul',
      type: 'list',
      version: 1,
    }
    const doc = createContentDoc(
      {
        content: state({ ...paragraph('p'), $: { blockId: 'blk1' } }, list),
        title: '',
      },
      'import 1',
    )

    const children = JSON.parse(readDocContent(doc).content).root.children

    expect(children[0].$).toEqual({ blockId: 'blk1' })
    expect(children[1].children[0].children[0].text).toBe('item')
  })

  it('merges a whole-document write made at an older version with newer edits', () => {
    const doc = createContentDoc(
      { content: state(paragraph('one'), paragraph('two')), title: 'T' },
      'import 1',
    )
    const base = doc.frontiers()
    doc.import(
      editDocAt(
        doc,
        doc.frontiers(),
        { content: state(paragraph('one'), paragraph('two!')), title: 'T' },
        'human:owner',
      ),
    )

    doc.import(
      editDocAt(
        doc,
        base,
        { content: state(paragraph('ONE'), paragraph('two')), title: 'T2' },
        'legacy-save 9',
      ),
    )

    const read = readDocContent(doc)
    expect(texts(read.content)).toEqual(['ONE', 'two!'])
    expect(read.title).toBe('T2')
  })

  it('commits a write under the peer it is given', () => {
    const doc = createContentDoc(
      { content: state(paragraph('one')), title: 'T' },
      'import 1',
    )

    const update = editDocAt(
      doc,
      doc.frontiers(),
      { content: state(paragraph('one'), paragraph('agent')), title: 'T' },
      'agent:add a line',
      { peer: '424242' },
    )
    doc.import(update)

    const agentChanges = doc.getAllChanges().get('424242')
    expect(agentChanges?.map((change) => change.message)).toEqual([
      'agent:add a line',
    ])
    expect(texts(readDocContent(doc).content)).toEqual(['one', 'agent'])
  })

  it('reverts one change while edits before and after it survive', () => {
    const doc = createContentDoc(
      { content: state(paragraph('a'), paragraph('b')), title: 'T' },
      'import 1',
    )
    const step = (content: string, message: string) => {
      doc.import(
        editDocAt(doc, doc.frontiers(), { content, title: 'T' }, message),
      )
    }
    step(state(paragraph('a1'), paragraph('b')), 'human:owner')
    const before = doc.frontiers()
    step(
      state(paragraph('a1'), paragraph('b'), paragraph('agent')),
      'agent:add',
    )
    const agentHead = doc.frontiers()
    step(
      state(paragraph('a1'), paragraph('b2'), paragraph('agent')),
      'human:owner',
    )

    doc.import(revertChange(doc, agentHead[0], before, 'undo agent'))

    expect(texts(readDocContent(doc).content)).toEqual(['a1', 'b2'])
  })

  it('rejects an update from a different document lineage', () => {
    const doc = createContentDoc(
      { content: state(paragraph('a')), title: 'T' },
      'import 1',
    )
    const stranger = createContentDoc(
      { content: state(paragraph('b')), title: 'T' },
      'import 2',
    )

    expect(() =>
      vetUpdate(doc, stranger.export({ mode: 'update' })),
    ).toThrowError(/lineage/)
  })

  it('rejects an update whose dependencies the document lacks', () => {
    const doc = createContentDoc(
      { content: state(paragraph('a')), title: 'T' },
      'import 1',
    )
    const peer = new LoroDoc()
    peer.import(doc.export({ mode: 'snapshot' }))
    const edit = (content: string) =>
      peer.import(
        editDocAt(peer, peer.frontiers(), { content, title: 'T' }, 'human'),
      )
    edit(state(paragraph('a'), paragraph('b')))
    const afterFirst = peer.oplogVersion()
    edit(state(paragraph('a'), paragraph('b'), paragraph('c')))

    expect(() =>
      vetUpdate(doc, peer.export({ from: afterFirst, mode: 'update' })),
    ).toThrowError(/missing/)
  })

  it('accepts a well-formed peer update and returns the merged probe', () => {
    const doc = createContentDoc(
      { content: state(paragraph('a')), title: 'T' },
      'import 1',
    )
    const peer = new LoroDoc()
    peer.import(doc.export({ mode: 'snapshot' }))
    peer.import(
      editDocAt(
        peer,
        peer.frontiers(),
        { content: state(paragraph('a'), paragraph('b')), title: 'T' },
        'human:owner',
      ),
    )

    const probe = vetUpdate(
      doc,
      peer.export({ from: doc.oplogVersion(), mode: 'update' }),
    )

    expect(texts(readDocContent(probe).content)).toEqual(['a', 'b'])
    expect(texts(readDocContent(doc).content)).toEqual(['a'])
  })

  it('refuses an update carrying changes that are not signed by the expected author', () => {
    const doc = createContentDoc(
      { content: state(paragraph('a')), title: 'T' },
      'import 1',
    )
    const peer = new LoroDoc()
    peer.import(doc.export({ mode: 'snapshot' }))
    const edit = (message: string, ...values: string[]) =>
      peer.import(
        editDocAt(
          peer,
          peer.frontiers(),
          { content: state(...values.map(paragraph)), title: 'T' },
          message,
        ),
      )
    edit('human:r1', 'a', 'b')
    const signed = peer.export({ from: doc.oplogVersion(), mode: 'update' })
    edit('agent:rewrite', 'a', 'b', 'c')
    const mixed = peer.export({ from: doc.oplogVersion(), mode: 'update' })

    expect(() => vetUpdate(doc, signed, { author: 'human:r1' })).not.toThrow()
    expect(() => vetUpdate(doc, signed, { author: 'human:r2' })).toThrowError(
      /author/,
    )
    expect(() => vetUpdate(doc, mixed, { author: 'human:r1' })).toThrowError(
      /author/,
    )
  })
})
