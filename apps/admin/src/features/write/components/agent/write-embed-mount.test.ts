import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'
import { describe, expect, it, vi } from 'vitest'

import { createWriteEmbedMount } from './write-embed-mount'

const OWN = 'https://cdn.example.test'

const doc = (children: SerializedLexicalNode[]) =>
  ({
    root: {
      type: 'root',
      version: 1,
      children,
      direction: null,
      format: '',
      indent: 0,
    },
  }) as SerializedEditorState

const drawing = (snapshot: string) =>
  ({
    type: 'excalidraw',
    version: 1,
    snapshot,
    $: { blockId: 'xc' },
  }) as unknown as SerializedLexicalNode

function setup() {
  const upload = vi.fn(async () => ({ url: `${OWN}/versions/v2.json` }))
  const fetchImpl = vi.fn(
    async (url: string) => new Response(JSON.stringify({ url, elements: [] })),
  )
  const mount = createWriteEmbedMount({
    readBlock: () => ({ snapshot: `${OWN}/a.json` }),
    getDraftId: () => '902',
    getOwnHosts: () => ['cdn.example.test', 'api.example.test'],
    apiUrl: 'https://api.example.test/v3',
    fetchImpl: fetchImpl as never,
    uploadImpl: upload as never,
  })
  return { mount, upload, fetchImpl }
}

describe('createWriteEmbedMount', () => {
  it('uploads an edited drawing as an immutable JSON version of its draft', async () => {
    const { mount, upload } = setup()
    const source = doc([drawing(`${OWN}/a.json`)])
    await mount.prefetch(source)
    const view = mount.toView(source)

    await mount.fromView(view.state, async () => '{"elements":[]}')

    const [file, type, options] = upload.mock.calls[0] as unknown as [
      File,
      string,
      Record<string, unknown>,
    ]
    expect(file.name).toBe('xc.json')
    expect(type).toBe('file')
    expect(options).toMatchObject({
      immutable: true,
      draftId: '902',
      parentUrl: `${OWN}/a.json`,
    })
    expect(typeof options.assetKey).toBe('string')
  })

  it('fetches ref: drawings through the API objects route', async () => {
    const { mount, fetchImpl } = setup()

    await mount.prefetch(doc([drawing('ref:file/a.json')]))

    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'https://api.example.test/v3/objects/file/a.json',
    )
  })

  it('patches a delta drawing onto its base', async () => {
    const { mount } = setup()
    const source = doc([drawing(`${OWN}/a.json\n{"title":["Old","New"]}`)])
    await mount.prefetch(source)
    const fetched = mount.toView(source)

    expect(fetched.files['/embeds/xc.excalidraw']).toBeDefined()
  })

  it('reshapes an edited drawing before uploading it', async () => {
    const remeasure = vi.fn(async () => '{"elements":["measured"]}')
    const upload = vi.fn(async () => ({ url: `${OWN}/versions/v3.json` }))
    const mount = createWriteEmbedMount({
      readBlock: () => null,
      getDraftId: () => undefined,
      getOwnHosts: () => ['cdn.example.test'],
      apiUrl: 'https://api.example.test',
      fetchImpl: (async () => new Response('{"elements":[]}')) as never,
      uploadImpl: upload as never,
      remeasure,
    })
    const source = doc([drawing(`${OWN}/a.json`)])
    await mount.prefetch(source)
    const view = mount.toView(source)

    await mount.fromView(view.state, async () => '{"elements":[1]}')

    const [file] = upload.mock.calls[0] as unknown as [File]
    expect(await file.text()).toBe('{"elements":["measured"]}')
  })
})
