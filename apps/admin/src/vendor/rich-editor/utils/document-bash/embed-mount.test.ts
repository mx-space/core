import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'
import { describe, expect, it, vi } from 'vitest'

import { createEmbedMount, type EmbedMountOptions } from './embed-mount'

const OWN = 'https://cdn.example.test'
const SCENE_URL = `${OWN}/2026/1108/arch.excalidraw`
const WIDGET_URL = `${OWN}/versions/widget.js`
const IMAGE_URL = `${OWN}/2026/1108/photo.png`
const THEIRS = `${OWN}/versions/theirs`

const scene = { elements: [{ id: 't1', type: 'text', text: '架构' }] }

function doc(children: SerializedLexicalNode[]): SerializedEditorState {
  return {
    root: {
      type: 'root',
      version: 1,
      children,
      direction: null,
      format: '',
      indent: 0,
    },
  } as SerializedEditorState
}

const node = (fields: Record<string, unknown>) =>
  ({ version: 1, ...fields }) as unknown as SerializedLexicalNode

const excalidraw = (id: string, snapshot: string) =>
  node({ type: 'excalidraw', snapshot, $: { blockId: id } })

const childAt = (state: SerializedEditorState, index: number) =>
  state.root.children[index] as unknown as Record<string, any>

function setup(overrides: Partial<EmbedMountOptions> = {}) {
  const remote = new Map<string, string>([
    [SCENE_URL, JSON.stringify(scene)],
    [WIDGET_URL, 'export default { mount() {} }'],
  ])
  const current = new Map<string, string>()
  let uploads = 0
  const options: EmbedMountOptions = {
    isOwnUrl: (url) => url.startsWith(OWN),
    fetchText: vi.fn(async (url: string) => {
      const text = remote.get(url)
      if (text === undefined) throw new Error(`404 ${url}`)
      return text
    }),
    applyDelta: vi.fn(async (base: any, delta: any) => ({
      ...base,
      ...delta,
    })),
    upload: vi.fn(async () => `${OWN}/versions/new-${++uploads}`),
    canUpload: () => true,
    getCurrentRef: (blockId) => current.get(blockId) ?? null,
    createAssetKey: () => 'fresh-key',
    ...overrides,
  }
  return { mount: createEmbedMount(options), options, current, remote }
}

async function open(state: SerializedEditorState, overrides = {}) {
  const ctx = setup(overrides)
  await ctx.mount.prefetch(state)
  const view = ctx.mount.toView(state)
  const files = new Map(Object.entries(view.files))
  const readFile = async (path: string) => files.get(path) ?? null
  return { ...ctx, view, files, readFile }
}

describe('createEmbedMount', () => {
  it('shows an own-storage drawing as a file and the block as its path', async () => {
    const { view } = await open(doc([excalidraw('xc', SCENE_URL)]))

    expect(childAt(view.state, 0).snapshot).toBe('/embeds/xc.excalidraw')
    expect(JSON.parse(view.files['/embeds/xc.excalidraw'])).toEqual(scene)
  })

  it('leaves a drawing on another site as it is', async () => {
    const outside = 'https://elsewhere.test/a.excalidraw'
    const { view } = await open(doc([excalidraw('xc', outside)]))

    expect(childAt(view.state, 0).snapshot).toBe(outside)
    expect(view.files).toEqual({})
  })

  it('restores the original state when nothing was edited', async () => {
    const source = doc([excalidraw('xc', SCENE_URL)])
    const { mount, view, readFile, options } = await open(source)

    const back = await mount.fromView(view.state, readFile)

    expect(back).toEqual(source)
    expect(options.upload).not.toHaveBeenCalled()
  })

  it('uploads an edited drawing as a new version and points the block at it', async () => {
    const { mount, view, files, readFile, options, current } = await open(
      doc([excalidraw('xc', SCENE_URL)]),
    )
    current.set('xc', SCENE_URL)
    files.set('/embeds/xc.excalidraw', JSON.stringify({ elements: [] }))

    const back = await mount.fromView(view.state, readFile)

    expect(childAt(back, 0).snapshot).toBe(`${OWN}/versions/new-1`)
    expect(options.upload).toHaveBeenCalledWith({
      path: '/embeds/xc.excalidraw',
      kind: 'excalidraw',
      content: JSON.stringify({ elements: [] }),
      assetKey: 'fresh-key',
      parentUrl: SCENE_URL,
    })
  })

  it('uploads the same edit only once across calls', async () => {
    const { mount, view, files, readFile, options } = await open(
      doc([excalidraw('xc', SCENE_URL)]),
    )
    files.set('/embeds/xc.excalidraw', '{"elements":[]}')

    await mount.fromView(view.state, readFile)
    const again = await mount.fromView(view.state, readFile)

    expect(options.upload).toHaveBeenCalledTimes(1)
    expect(childAt(again, 0).snapshot).toBe(`${OWN}/versions/new-1`)
  })

  it('keeps an inline drawing inline without uploading', async () => {
    const { mount, view, files, readFile, options } = await open(
      doc([excalidraw('xc', JSON.stringify(scene))]),
    )
    expect(childAt(view.state, 0).snapshot).toBe('/embeds/xc.excalidraw')
    files.set('/embeds/xc.excalidraw', '{\n  "elements": []\n}')

    const back = await mount.fromView(view.state, readFile)

    expect(childAt(back, 0).snapshot).toBe('{"elements":[]}')
    expect(options.upload).not.toHaveBeenCalled()
  })

  it('shows a delta drawing patched and keeps its delta form when untouched', async () => {
    const snapshot = `${SCENE_URL}\n{"title":"v2"}`
    const source = doc([excalidraw('xc', snapshot)])
    const { mount, view, readFile } = await open(source)

    expect(JSON.parse(view.files['/embeds/xc.excalidraw'])).toEqual({
      ...scene,
      title: 'v2',
    })
    expect(await mount.fromView(view.state, readFile)).toEqual(source)
  })

  it('maps a dynamic component to its source file and uploads an edit', async () => {
    const dynamic = node({
      type: 'dynamic',
      url: WIDGET_URL,
      props: { lang: 'en' },
      initialHeight: 320,
      $: { blockId: 'dy' },
    })
    const { mount, view, files, readFile, options } = await open(doc([dynamic]))

    expect(childAt(view.state, 0).url).toBe('/embeds/dy.js')
    expect(view.files['/embeds/dy.js']).toBe('export default { mount() {} }')

    files.set('/embeds/dy.js', 'export default { mount() { return {} } }')
    const back = await mount.fromView(view.state, readFile)

    expect(childAt(back, 0).url).toBe(`${OWN}/versions/new-1`)
    expect(childAt(back, 0).props).toEqual({ lang: 'en' })
    expect(options.upload).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'dynamic', parentUrl: WIDGET_URL }),
    )
  })

  it('shows an own-storage image as read-only metadata and maps it back', async () => {
    const image = node({
      type: 'image',
      src: IMAGE_URL,
      altText: '机房',
      width: 800,
      height: 600,
      $: { blockId: 'im' },
    })
    const source = doc([image])
    const { mount, view, readFile } = await open(source)

    expect(childAt(view.state, 0).src).toBe('/embeds/im.png')
    expect(view.readonly).toContain('/embeds/im.png')
    expect(view.files['/embeds/im.png']).toContain('image/png')
    expect(view.files['/embeds/im.png']).toContain('800x600')
    expect(await mount.fromView(view.state, readFile)).toEqual(source)
  })

  it('names gallery images by their URL and maps them back', async () => {
    const gallery = node({
      type: 'gallery',
      images: [{ src: IMAGE_URL, alt: 'a' }],
      $: { blockId: 'ga' },
    })
    const source = doc([gallery])
    const { mount, view, readFile } = await open(source)

    const path = childAt(view.state, 0).images[0].src
    expect(path).toMatch(/^\/embeds\/[\da-f]{8}\.png$/)
    expect(await mount.fromView(view.state, readFile)).toEqual(source)
  })

  it('uploads a new file the agent created under a new key', async () => {
    const { mount, view, files, readFile, options } = await open(doc([]))
    files.set('/embeds/arch-en.excalidraw', '{"elements":[]}')
    const added = doc([excalidraw('', '/embeds/arch-en.excalidraw')])

    const back = await mount.fromView(added, readFile)

    expect(childAt(back, 0).snapshot).toBe(`${OWN}/versions/new-1`)
    expect(options.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/embeds/arch-en.excalidraw',
        assetKey: 'fresh-key',
        parentUrl: undefined,
      }),
    )
    expect(view.files).toEqual({})
  })

  it('refuses a block that points at a missing file', async () => {
    const { mount, readFile } = await open(doc([]))

    await expect(
      mount.fromView(
        doc([excalidraw('', '/embeds/nope.excalidraw')]),
        readFile,
      ),
    ).rejects.toThrow('/embeds/nope.excalidraw')
  })

  it('keeps their version of a drawing someone changed during the run', async () => {
    const { mount, view, files, readFile, current, options, remote } =
      await open(doc([excalidraw('xc', SCENE_URL)]))
    remote.set(THEIRS, '{"elements":[{"id":"t2","text":"theirs"}]}')
    current.set('xc', THEIRS)
    files.set('/embeds/xc.excalidraw', '{"elements":[]}')

    const back = await mount.fromView(view.state, readFile)
    const report = mount.takeReport()

    expect(options.upload).not.toHaveBeenCalled()
    expect(childAt(back, 0).snapshot).toBe(THEIRS)
    expect(report.notices.join('\n')).toMatch(
      /\/embeds\/xc\.excalidraw.*changed by someone else/,
    )
    expect(report.files['/embeds/xc.excalidraw']).toContain('theirs')
  })

  it('checks a block against its own base when it points at a new file', async () => {
    const { mount, files, readFile, current, options, remote } = await open(
      doc([excalidraw('xc', SCENE_URL)]),
    )
    remote.set(THEIRS, '{"elements":[]}')
    current.set('xc', THEIRS)
    files.set('/embeds/mine.excalidraw', '{"elements":[{"id":"m"}]}')

    const back = await mount.fromView(
      doc([excalidraw('xc', '/embeds/mine.excalidraw')]),
      readFile,
    )

    expect(options.upload).not.toHaveBeenCalled()
    expect(childAt(back, 0).snapshot).toBe(THEIRS)
    expect(childAt(mount.takeReport().view!, 0).snapshot).toBe(
      '/embeds/xc.excalidraw',
    )
  })

  it('applies the other edits when one drawing conflicts', async () => {
    const { mount, view, files, readFile, current, options, remote } =
      await open(
        doc([excalidraw('xc', SCENE_URL), excalidraw('yy', SCENE_URL)]),
      )
    remote.set(THEIRS, '{"elements":[{"id":"t2","text":"theirs"}]}')
    current.set('xc', THEIRS)
    current.set('yy', SCENE_URL)
    files.set('/embeds/xc.excalidraw', '{"elements":[]}')
    files.set('/embeds/yy.excalidraw', '{"elements":[{"id":"y"}]}')

    const back = await mount.fromView(view.state, readFile)
    const report = mount.takeReport()
    for (const [path, text] of Object.entries(report.files))
      files.set(path, text)
    const again = await mount.fromView(view.state, readFile)

    expect(childAt(back, 1).snapshot).toBe(`${OWN}/versions/new-1`)
    expect(childAt(again, 0).snapshot).toBe(THEIRS)
    expect(options.upload).toHaveBeenCalledTimes(1)
  })

  it('hides image data inside a drawing and restores it on upload', async () => {
    const { mount, remote, options } = setup()
    remote.set(
      SCENE_URL,
      JSON.stringify({
        elements: [{ id: 'img', type: 'image', fileId: 'f1' }],
        files: {
          f1: {
            id: 'f1',
            mimeType: 'image/png',
            dataURL: 'data:image/png;base64,AAAA',
          },
        },
      }),
    )
    const state = doc([excalidraw('xc', SCENE_URL)])
    await mount.prefetch(state)
    const view = mount.toView(state)
    const text = view.files['/embeds/xc.excalidraw']
    const edited = text.replace('"img"', '"img2"')

    await mount.fromView(view.state, async () => edited)

    expect(text).not.toContain('base64,AAAA')
    expect(text).toContain('omitted:f1')
    expect(vi.mocked(options.upload).mock.calls[0][0].content).toContain(
      'data:image/png;base64,AAAA',
    )
  })

  it('reports a failed upload and retries it on the next call', async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(`${OWN}/versions/retry`)
    const { mount, view, files, readFile } = await open(
      doc([excalidraw('xc', SCENE_URL)]),
      { upload },
    )
    files.set('/embeds/xc.excalidraw', '{"elements":[]}')

    await expect(mount.fromView(view.state, readFile)).rejects.toThrow(
      /network down/,
    )
    const back = await mount.fromView(view.state, readFile)

    expect(childAt(back, 0).snapshot).toBe(`${OWN}/versions/retry`)
  })

  it('refuses edits when uploads are not allowed', async () => {
    const { mount, view, files, readFile } = await open(
      doc([excalidraw('xc', SCENE_URL)]),
      { canUpload: () => false },
    )
    files.set('/embeds/xc.excalidraw', '{"elements":[]}')

    await expect(mount.fromView(view.state, readFile)).rejects.toThrow(
      /read-only/,
    )
  })

  it('writes an error file and keeps the URL when a drawing cannot be fetched', async () => {
    const missing = `${OWN}/gone.excalidraw`
    const { view } = await open(doc([excalidraw('xc', missing)]))

    expect(childAt(view.state, 0).snapshot).toBe(missing)
    expect(view.files['/embeds/xc.error']).toContain('404')
    expect(view.readonly).toContain('/embeds/xc.error')
  })

  it('describes each file version by its source URL', async () => {
    const { mount } = await open(doc([excalidraw('xc', SCENE_URL)]))

    expect(mount.versionOf('/embeds/xc.excalidraw')).toBe(
      `version ${SCENE_URL}`,
    )
  })

  it('keeps the session files when a view is built only for display', async () => {
    const { mount, view, files, readFile, options } = await open(
      doc([excalidraw('xc', SCENE_URL)]),
    )
    const display = mount.toView(doc([excalidraw('xc', SCENE_URL)]), {
      remember: false,
    })
    files.set('/embeds/xc.excalidraw', '{"elements":[]}')

    await mount.fromView(view.state, readFile)

    expect(childAt(display.state, 0).snapshot).toBe('/embeds/xc.excalidraw')
    expect(options.upload).toHaveBeenCalledWith(
      expect.objectContaining({ parentUrl: SCENE_URL }),
    )
  })

  it('shows an uploaded version under the same path with its new content', async () => {
    const { mount, view, files, readFile } = await open(
      doc([excalidraw('xc', SCENE_URL)]),
    )
    files.set('/embeds/xc.excalidraw', '{"elements":[]}')
    const back = await mount.fromView(view.state, readFile)

    const next = mount.toView(back, { remember: false })

    expect(childAt(next.state, 0).snapshot).toBe('/embeds/xc.excalidraw')
    expect(next.files['/embeds/xc.excalidraw']).toBe('{"elements":[]}')
  })

  it('maps a single node for display', async () => {
    const { mount } = await open(doc([excalidraw('xc', SCENE_URL)]))

    const shown = mount.viewNode(excalidraw('xc', SCENE_URL)) as any

    expect(shown.snapshot).toBe('/embeds/xc.excalidraw')
  })

  it('uploads the drawing as reshaped by the scene transform', async () => {
    const transformScene = vi.fn(async () => '{"elements":["measured"]}')
    const { mount, view, files, readFile, options } = await open(
      doc([excalidraw('xc', SCENE_URL)]),
      { transformScene },
    )
    files.set('/embeds/xc.excalidraw', '{"elements":[]}')

    await mount.fromView(view.state, readFile)

    expect(transformScene).toHaveBeenCalledWith(
      '{"elements":[]}',
      view.files['/embeds/xc.excalidraw'],
    )
    expect(options.upload).toHaveBeenCalledWith(
      expect.objectContaining({ content: '{"elements":["measured"]}' }),
    )
  })

  describe('dynamic component metadata', () => {
    const dynamic = node({
      type: 'dynamic',
      url: WIDGET_URL,
      props: {},
      initialHeight: 320,
      $: { blockId: 'dy' },
    })
    const catalogMeta = { name: 'Chart', description: 'Bars', propsSchema: {} }

    const openWithMeta = () =>
      open(doc([dynamic]), {
        dynamicMeta: {
          read: vi.fn(async () => catalogMeta),
          save: vi.fn(async () => {}),
        },
      })

    it('shows the catalog entry beside the source', async () => {
      const { view } = await openWithMeta()

      expect(JSON.parse(view.files['/embeds/dy.meta.json'])).toEqual(
        catalogMeta,
      )
    })

    it('writes a metadata-only edit straight to the catalog', async () => {
      const { mount, view, files, readFile, options } = await openWithMeta()
      files.set(
        '/embeds/dy.meta.json',
        JSON.stringify({ ...catalogMeta, description: 'Stacked bars' }),
      )

      const back = await mount.fromView(view.state, readFile)

      expect(childAt(back, 0).url).toBe(WIDGET_URL)
      expect(options.upload).not.toHaveBeenCalled()
      expect(options.dynamicMeta!.save).toHaveBeenCalledWith(WIDGET_URL, {
        ...catalogMeta,
        description: 'Stacked bars',
      })
    })

    it('holds the metadata of a new version until it is registered', async () => {
      const { mount, view, files, readFile, options } = await openWithMeta()
      files.set('/embeds/dy.js', 'export default {}')
      files.set('/embeds/dy.meta.json', JSON.stringify({ name: 'Chart v2' }))

      const back = await mount.fromView(view.state, readFile)

      expect(options.dynamicMeta!.save).not.toHaveBeenCalled()
      expect(mount.pendingDynamic(childAt(back, 0).url)).toEqual({
        parentUrl: WIDGET_URL,
        meta: { name: 'Chart v2' },
      })
    })

    it('refuses metadata that is not a JSON object', async () => {
      const { mount, view, files, readFile } = await openWithMeta()
      files.set('/embeds/dy.meta.json', '[1, 2')

      await expect(mount.fromView(view.state, readFile)).rejects.toThrow(
        '/embeds/dy.meta.json',
      )
    })
  })
})
