import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'
import { describe, expect, it, vi } from 'vitest'

import { createDocumentBashWorkspace } from './create-document-bash-tool'
import { createEmbedMount } from './embed-mount'

function para(id: string, text: string): SerializedLexicalNode {
  return {
    type: 'paragraph',
    version: 1,
    children: [
      {
        type: 'text',
        text,
        version: 1,
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    $: { blockId: id },
  } as SerializedLexicalNode
}

function state(children: SerializedLexicalNode[]): SerializedEditorState {
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

function createWorkspace(doc = state([para('a', 'Hello world')])) {
  return createDocumentBashWorkspace({
    getEditorState: () => doc,
  })
}

describe('createDocumentBashWorkspace readonly files', () => {
  const skillPath = '/skills/chart/SKILL.md'

  function createSkillWorkspace() {
    const workspace = createDocumentBashWorkspace({
      getEditorState: () => state([para('a', 'Hello world')]),
      readonlyFiles: { [skillPath]: 'Use one accent color.\n' },
    })
    workspace.beginRun()
    return workspace
  }

  it('lets bash read them', async () => {
    const result = await createSkillWorkspace().tool.execute({
      command: `cat ${skillPath}`,
    })
    expect(result.ok && result.content).toContain('Use one accent color.')
  })

  it.each([
    `sed -i 's/one/two/' ${skillPath}`,
    `echo x > ${skillPath}`,
    `rm ${skillPath}`,
    `mv ${skillPath} /tmp/moved`,
    'touch /skills/chart/new.md',
  ])('refuses to change them: %s', async (command) => {
    const workspace = createSkillWorkspace()
    const write = await workspace.tool.execute({ command })
    expect(write.ok && write.content).toMatch(/read-only/i)
    const read = await workspace.tool.execute({ command: `cat ${skillPath}` })
    expect(read.ok && read.content).toBe('Use one accent color.\n')
  })

  it('still allows copying them out', async () => {
    const result = await createSkillWorkspace().tool.execute({
      command: `cp ${skillPath} /tmp/copy && cat /tmp/copy`,
    })
    expect(result.ok && result.content).toContain('Use one accent color.')
  })
})

describe('createDocumentBashWorkspace', () => {
  it('lets bash read the seeded document', async () => {
    const workspace = createWorkspace()
    workspace.beginRun()
    const result = await workspace.tool.execute({ command: 'cat /doc.xml' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).toContain('Hello world')
    expect(result.content).toContain('id="a"')
    expect(result.operations).toBeUndefined()
  })

  it('provides /tmp and refreshes the outline after an edit', async () => {
    const workspace = createWorkspace()
    workspace.beginRun()
    const tmp = await workspace.tool.execute({
      command: 'cp /doc.xml /tmp/bak && ls /tmp',
    })
    expect(tmp.ok && tmp.content).toContain('bak')
    await workspace.tool.execute({
      command: "sed -i 's/Hello world/Hello earth/' /doc.xml",
    })
    const outline = await workspace.tool.execute({
      command: 'cat /.meta/outline',
    })
    expect(outline.ok && outline.content).toContain('Hello earth')
  })

  it('stubs python3 instead of command-not-found', async () => {
    const workspace = createWorkspace()
    workspace.beginRun()
    const result = await workspace.tool.execute({
      command: 'python3 -c "print(1)"',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).toContain('python3 is not available')
    expect(result.content).toContain('sed')
  })

  it('reports a no-op instead of an empty batch when the rewrite parses to the same document', async () => {
    const workspace = createWorkspace()
    workspace.beginRun()
    const result = await workspace.tool.execute({
      command: "sed -i 's|</p>$|</p> |' /doc.xml",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operations).toBeUndefined()
    expect(result.content).toContain('parses to the same document')
  })

  it('returns replace-mode operations after the document is edited', async () => {
    const workspace = createWorkspace()
    workspace.beginRun()
    const edited = await workspace.tool.execute({
      command: "sed -i 's/Hello world/Hello earth/' /doc.xml",
    })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(edited.operationsMode).toBe('replace')
    expect(edited.operations).toEqual([
      expect.objectContaining({
        op: 'replace',
        blockId: 'a',
      }),
    ])

    const grepped = await workspace.tool.execute({
      command: 'grep earth /doc.xml',
    })
    expect(grepped.ok).toBe(true)
    if (!grepped.ok) return
    expect(grepped.content).toContain('Hello earth')
    expect(grepped.operations).toBeUndefined()
  })

  it('applies an edit straight to the document when it owns the writes', async () => {
    const applied: { focus?: string; target: SerializedEditorState }[] = []
    const workspace = createDocumentBashWorkspace({
      applyDocument: (target, focus) => {
        applied.push({ focus, target })
      },
      getEditorState: () => state([para('a', 'Hello world')]),
    })
    workspace.beginRun()

    const edited = await workspace.tool.execute({
      command: "sed -i 's/Hello world/Hello earth/' /doc.xml",
    })
    const appended = await workspace.tool.execute({
      command: "sed -i 's|</doc>|  <p>Second</p>\\n</doc>|' /doc.xml",
    })

    expect(edited.ok && edited.operations).toBeFalsy()
    expect(appended.ok && appended.operations).toBeFalsy()
    expect(applied).toHaveLength(2)
    expect(JSON.stringify(applied[0].target)).toContain('Hello earth')
    expect(applied[0].focus).toBe('a')
    const blocks = applied[1].target.root.children as SerializedLexicalNode[]
    const minted = (blocks[1] as { $?: { blockId?: string } }).$?.blockId
    expect(minted).toBeTruthy()
    expect(applied[1].focus).toBe(minted)
  })

  it('keeps untouched blocks exactly as the document holds them when applying', async () => {
    const styled = {
      ...para('a', 'Centred red'),
      format: 'center',
      indent: 1,
      children: [
        {
          type: 'text',
          text: 'Centred red',
          version: 1,
          detail: 0,
          format: 1,
          mode: 'normal',
          style: 'color: red;',
        },
      ],
    } as SerializedLexicalNode
    let target: SerializedEditorState | null = null
    const workspace = createDocumentBashWorkspace({
      applyDocument: (next) => {
        target = next
      },
      getEditorState: () => state([styled, para('b', 'Plain')]),
    })
    workspace.beginRun()

    await workspace.tool.execute({
      command: "sed -i 's/Plain/Plainer/' /doc.xml",
    })

    const blocks = target!.root.children as SerializedLexicalNode[]
    expect(blocks[0]).toEqual(styled)
    expect(JSON.stringify(blocks[1])).toContain('Plainer')
  })

  it('reports its own copy of the document while it owns the writes', async () => {
    let live = state([para('a', 'Hello world')])
    const workspace = createDocumentBashWorkspace({
      applyDocument: () => undefined,
      getEditorState: () => live,
    })
    workspace.beginRun()
    await workspace.tool.execute({ command: 'cat /doc.xml' })

    live = state([para('a', 'Typed by someone else')])

    const doc = workspace
      .snapshotFiles()
      .find((file) => file.path === '/doc.xml')
    expect(doc?.content).toContain('Hello world')
    expect(doc?.content).not.toContain('someone else')
  })

  it('reports the files a command read, with their current content', async () => {
    const workspace = createWorkspace()
    workspace.beginRun()
    await workspace.tool.execute({ command: 'cat /doc.xml' })

    const touched = workspace.touchedFiles()
    expect(touched.map((file) => file.path)).toEqual(['/doc.xml'])
    expect(touched[0].content).toContain('Hello world')
  })

  it('reports no files for a command that touches none of them', async () => {
    const workspace = createWorkspace()
    workspace.beginRun()
    await workspace.tool.execute({ command: 'cat /doc.xml' })
    await workspace.tool.execute({ command: 'echo hi' })

    expect(workspace.touchedFiles()).toEqual([])
  })

  it('reports the accepted document and the pending review after the agent rewrites it', async () => {
    let review = ''
    const workspace = createDocumentBashWorkspace({
      getEditorState: () => state([para('a', 'Hello world')]),
      getReviewXml: () => review,
    })
    workspace.beginRun()
    await workspace.tool.execute({
      command: "sed -i 's/Hello world/Hello earth/' /doc.xml",
    })
    review = '<review>\n<replace block="a">Hello earth</replace>\n</review>'

    const touched = workspace.touchedFiles()
    expect(touched.find((f) => f.path === '/doc.xml')?.content).toContain(
      'Hello world',
    )
    expect(touched.find((f) => f.path === '/review.xml')?.content).toBe(review)
  })

  it('exposes pending proposals as /review.xml', async () => {
    const workspace = createDocumentBashWorkspace({
      getEditorState: () => state([para('a', 'Hello world')]),
      getReviewXml: () => '<review>\n<delete block="a"/>\n</review>',
    })
    workspace.beginRun()
    const result = await workspace.tool.execute({ command: 'cat /review.xml' })

    expect(result.ok && result.content).toContain('<delete block="a"/>')
    expect(workspace.touchedFiles().map((f) => f.path)).toEqual(['/review.xml'])
  })

  it('exposes the selection as /selection.xml', async () => {
    const workspace = createDocumentBashWorkspace({
      getEditorState: () => state([para('a', 'Hello world')]),
      getSelectionXml: () => '<p id="a">Hello world</p>',
    })
    workspace.beginRun()
    const result = await workspace.tool.execute({
      command: 'cat /selection.xml',
    })

    expect(result.ok && result.content).toContain('<p id="a">Hello world</p>')
    expect(workspace.touchedFiles().map((f) => f.path)).toEqual([
      '/selection.xml',
    ])
  })

  it('snapshots the live files for the start of a turn', () => {
    let doc = state([para('a', 'Hello world')])
    const workspace = createDocumentBashWorkspace({
      getEditorState: () => doc,
      getSelectionXml: () => '<p id="a">Hello world</p>',
    })
    doc = state([para('a', 'Hello again')])

    const files = workspace.snapshotFiles()
    expect(files.find((f) => f.path === '/doc.xml')?.content).toContain(
      'Hello again',
    )
    expect(files.find((f) => f.path === '/selection.xml')).toEqual({
      path: '/selection.xml',
      content: '<p id="a">Hello world</p>',
      attach: true,
    })
    expect(files.find((f) => f.path === '/review.xml')).toEqual({
      path: '/review.xml',
      content: '',
      attach: true,
    })
  })

  it.each([
    ['cp /doc.xml /tmp/a.xml', ['/doc.xml']],
    [
      "cat /doc.xml > /dev/null && printf '<p>x</p>' > /tmp/b.xml && mv /tmp/b.xml /doc.xml",
      ['/doc.xml'],
    ],
    ['cp /doc.xml /tmp/a.xml && cp /tmp/a.xml /doc.xml', ['/doc.xml']],
  ])('tracks %s', async (command, expected) => {
    const workspace = createWorkspace()
    workspace.beginRun()
    await workspace.tool.execute({ command })

    expect(
      workspace
        .touchedFiles()
        .filter((file) => file.path !== '/review.xml')
        .map((file) => file.path),
    ).toEqual(expected)
  })

  it('explains that blocks appended after </doc> are outside the document', async () => {
    const workspace = createWorkspace()
    workspace.beginRun()

    const result = await workspace.tool.execute({
      command: "cat /doc.xml > /dev/null && echo '  <p>Tail</p>' >> /doc.xml",
    })

    expect(result.ok && result.operations).toBeFalsy()
    expect(result.ok && result.content).toContain('after </doc>')
  })

  describe('with proposals under review', () => {
    const accepted = state([para('a', 'Hello world')])
    const proposed = state([
      para('a', 'Hello world'),
      para('p1', 'Pending line'),
    ])

    function workspaceWithPending() {
      return createDocumentBashWorkspace({
        getBaseState: () => accepted,
        getEditorState: () => proposed,
      })
    }

    it('shows them in /doc.xml', async () => {
      const workspace = workspaceWithPending()
      workspace.beginRun()

      const result = await workspace.tool.execute({ command: 'cat /doc.xml' })

      expect(result.ok && result.content).toContain('Pending line')
    })

    it('diffs an edit against the accepted document so the proposal stays whole', async () => {
      const workspace = workspaceWithPending()
      workspace.beginRun()

      const result = await workspace.tool.execute({
        command: "sed -i 's/Hello world/Hello earth/' /doc.xml",
      })

      expect(result.ok && result.operations).toEqual([
        expect.objectContaining({ blockId: 'a', op: 'replace' }),
        expect.objectContaining({
          node: expect.objectContaining({
            $: expect.objectContaining({ blockId: 'p1' }),
          }),
          op: 'insert',
        }),
      ])
    })

    it('withdraws them when the agent removes them', async () => {
      const workspace = workspaceWithPending()
      workspace.beginRun()

      const result = await workspace.tool.execute({
        command: "sed -i '/Pending line/d' /doc.xml",
      })

      expect(result.ok && result.operations).toEqual([])
      expect(result.ok && result.operationsMode).toBe('replace')
    })

    it('treats a rewrite that parses to the current view as a no-op', async () => {
      const workspace = workspaceWithPending()
      workspace.beginRun()

      const result = await workspace.tool.execute({
        command: "sed -i 's|</p>$|</p> |' /doc.xml",
      })

      expect(result.ok && result.operations).toBeUndefined()
      expect(result.ok && result.content).toContain(
        'parses to the same document',
      )
    })
  })
})

describe('createDocumentBashWorkspace embedded files', () => {
  const SCENE_URL = 'https://cdn.example.test/arch.excalidraw'

  function drawing(id: string, snapshot: string) {
    return {
      type: 'excalidraw',
      version: 1,
      snapshot,
      $: { blockId: id },
    } as unknown as SerializedLexicalNode
  }

  function setup(canUpload = true) {
    const upload = vi.fn(async () => 'https://cdn.example.test/versions/v2')
    const embeds = createEmbedMount({
      isOwnUrl: (url) => url.startsWith('https://cdn.example.test/'),
      fetchText: async () => '{"elements":[{"id":"t1","text":"架构"}]}',
      applyDelta: async (base) => base,
      upload,
      canUpload: () => canUpload,
      getCurrentRef: () => SCENE_URL,
      createAssetKey: () => 'k1',
    })
    const workspace = createDocumentBashWorkspace({
      getEditorState: () =>
        state([para('a', 'Intro'), drawing('xc', SCENE_URL)]),
      embeds,
    })
    workspace.beginRun()
    return { workspace, upload }
  }

  it('shows the drawing as a file referenced by path', async () => {
    const { workspace } = setup()
    const result = await workspace.tool.execute({
      command: 'cat /doc.xml /embeds/xc.excalidraw',
    })
    expect(result.ok && result.content).toContain('/embeds/xc.excalidraw')
    expect(result.ok && result.content).not.toContain(SCENE_URL)
    expect(result.ok && result.content).toContain('架构')
  })

  it('proposes the drawing at a new URL after an edit to its file alone', async () => {
    const { workspace, upload } = setup()
    const result = await workspace.tool.execute({
      command: "sed -i 's/架构/Architecture/' /embeds/xc.excalidraw",
    })
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result.ok && result.operations).toEqual([
      expect.objectContaining({
        op: 'replace',
        blockId: 'xc',
        node: expect.objectContaining({
          snapshot: 'https://cdn.example.test/versions/v2',
        }),
      }),
    ])
  })

  it('keeps the path in /doc.xml after minting ids for a new block', async () => {
    const { workspace } = setup()
    await workspace.tool.execute({
      command:
        "sed -i 's|</doc>|  <p>Added</p>\\n</doc>|' /doc.xml && cat /doc.xml",
    })
    const read = await workspace.tool.execute({ command: 'cat /doc.xml' })
    expect(read.ok && read.content).toContain('/embeds/xc.excalidraw')
    expect(read.ok && read.content).not.toContain(SCENE_URL)
  })

  it('refuses to edit embedded files when uploads are not allowed', async () => {
    const { workspace, upload } = setup(false)
    const result = await workspace.tool.execute({
      command: "sed -i 's/架构/x/' /embeds/xc.excalidraw",
    })
    expect(result.ok && result.content).toMatch(/read-only/i)
    expect(upload).not.toHaveBeenCalled()
  })

  it('reports embedded files by version in the turn snapshot', async () => {
    const { workspace } = setup()
    await workspace.tool.execute({ command: 'cat /embeds/xc.excalidraw' })
    const touched = workspace.touchedFiles()
    expect(touched).toContainEqual({
      path: '/embeds/xc.excalidraw',
      content: `version ${SCENE_URL}`,
    })
  })

  it('keeps their version of a drawing that changed under the agent and says so', async () => {
    const theirs = 'https://cdn.example.test/versions/theirs'
    let live = SCENE_URL
    const embeds = createEmbedMount({
      isOwnUrl: (url) => url.startsWith('https://cdn.example.test/'),
      fetchText: async (url) =>
        url === theirs
          ? '{"elements":[{"id":"t9","text":"theirs"}]}'
          : '{"elements":[{"id":"t1","text":"架构"}]}',
      applyDelta: async (base) => base,
      upload: vi.fn(async () => 'https://cdn.example.test/versions/v2'),
      canUpload: () => true,
      getCurrentRef: () => live,
      createAssetKey: () => 'k1',
    })
    const workspace = createDocumentBashWorkspace({
      getEditorState: () => state([drawing('xc', SCENE_URL)]),
      embeds,
    })
    workspace.beginRun()
    await workspace.tool.execute({ command: 'cat /embeds/xc.excalidraw' })
    live = theirs

    const result = await workspace.tool.execute({
      command: "sed -i 's/架构/x/' /embeds/xc.excalidraw",
    })
    const read = await workspace.tool.execute({
      command: 'cat /embeds/xc.excalidraw',
    })

    expect(result.ok && result.content).toMatch(/changed by someone else/)
    expect(read.ok && read.content).toContain('theirs')
  })

  it('says the catalog was updated after an edit to the metadata alone', async () => {
    const save = vi.fn(async () => {})
    const url = 'https://cdn.example.test/versions/w.js'
    const embeds = createEmbedMount({
      isOwnUrl: (value) => value.startsWith('https://cdn.example.test/'),
      fetchText: async () => 'export default {}',
      applyDelta: async (base) => base,
      upload: vi.fn(),
      canUpload: () => true,
      getCurrentRef: () => url,
      createAssetKey: () => 'k',
      dynamicMeta: { read: async () => ({ name: 'Old' }), save },
    })
    const workspace = createDocumentBashWorkspace({
      getEditorState: () =>
        state([
          {
            type: 'dynamic',
            version: 1,
            url,
            $: { blockId: 'dy' },
          } as unknown as SerializedLexicalNode,
        ]),
      embeds,
    })
    workspace.beginRun()

    const result = await workspace.tool.execute({
      command: `echo '{"name":"New"}' > /embeds/dy.meta.json`,
    })

    expect(save).toHaveBeenCalledWith(url, { name: 'New' })
    expect(result.ok && result.content).toMatch(/component catalog/)
    expect(result.ok && result.content).not.toMatch(/no edit was recorded/)
  })

  it('shows at most 8 images per command and says which were left out', async () => {
    const embeds = createEmbedMount({
      isOwnUrl: (url) => url.startsWith('https://cdn.example.test/'),
      fetchText: async () => '',
      applyDelta: async (base) => base,
      upload: vi.fn(),
      canUpload: () => true,
      getCurrentRef: () => null,
      createAssetKey: () => 'k',
    })
    const ids = Array.from({ length: 9 }, (_, index) => `i${index}`)
    const workspace = createDocumentBashWorkspace({
      getEditorState: () =>
        state(
          ids.map(
            (id) =>
              ({
                type: 'image',
                version: 1,
                src: `https://cdn.example.test/${id}.png`,
                $: { blockId: id },
              }) as unknown as SerializedLexicalNode,
          ),
        ),
      embeds,
    })
    workspace.beginRun()

    const result = await workspace.tool.execute({
      command: `view ${ids.map((id) => `/embeds/${id}.png`).join(' ')}`,
    })

    expect((result as { images?: unknown[] }).images).toHaveLength(8)
    expect(result.ok && result.content).toMatch(/\/embeds\/i8\.png.*at most 8/)
  })

  it('shows an own-storage image to the model with view', async () => {
    const embeds = createEmbedMount({
      isOwnUrl: (url) => url.startsWith('https://cdn.example.test/'),
      fetchText: async () => '',
      applyDelta: async (base) => base,
      upload: vi.fn(),
      canUpload: () => true,
      getCurrentRef: () => null,
      createAssetKey: () => 'k',
    })
    const workspace = createDocumentBashWorkspace({
      getEditorState: () =>
        state([
          {
            type: 'image',
            version: 1,
            src: 'https://cdn.example.test/p.png',
            $: { blockId: 'im' },
          } as unknown as SerializedLexicalNode,
        ]),
      embeds,
    })
    workspace.beginRun()

    const shown = await workspace.tool.execute({
      command: 'view /embeds/im.png',
    })
    const missing = await workspace.tool.execute({ command: 'view /doc.xml' })

    expect(shown).toMatchObject({
      ok: true,
      images: [
        { url: 'https://cdn.example.test/p.png', mimeType: 'image/png' },
      ],
    })
    expect(missing.ok && missing.content).toMatch(/not an image/)
    expect(missing).not.toHaveProperty('images')
  })

  it('adds a generated image the agent can reference by path', async () => {
    const embeds = createEmbedMount({
      isOwnUrl: (url) => url.startsWith('https://cdn.example.test/'),
      fetchText: async () => '',
      applyDelta: async (base) => base,
      upload: vi.fn(),
      canUpload: () => true,
      getCurrentRef: () => null,
      createAssetKey: () => 'k',
    })
    const workspace = createDocumentBashWorkspace({
      getEditorState: () => state([para('a', 'Intro')]),
      embeds,
    })
    workspace.beginRun()

    const path = await workspace.addEmbedFile(
      'https://cdn.example.test/ai.png',
      'server room',
    )
    const meta = await workspace.tool.execute({ command: `cat ${path}` })
    const added = await workspace.tool.execute({
      command: `sed -i 's|</doc>|  <img src="${path}" alt="x" />\\n</doc>|' /doc.xml`,
    })

    expect(path).toBe('/embeds/server-room.png')
    expect(meta.ok && meta.content).toContain('image/png')
    expect(added.ok && added.operations).toEqual([
      expect.objectContaining({
        op: 'insert',
        node: expect.objectContaining({
          src: 'https://cdn.example.test/ai.png',
        }),
      }),
    ])
  })
})
