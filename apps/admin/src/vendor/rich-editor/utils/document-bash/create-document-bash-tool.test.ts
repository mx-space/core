import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'
import { describe, expect, it } from 'vitest'

import { createDocumentBashWorkspace } from './create-document-bash-tool'

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
})
