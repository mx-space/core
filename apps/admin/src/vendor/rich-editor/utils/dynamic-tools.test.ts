import { blockIdState } from '@haklex/rich-editor'
import {
  $createDynamicEditNode,
  DynamicEditNode,
} from '@haklex/rich-ext-dynamic'
import type { LexicalEditor } from 'lexical'
import { $getRoot, $setState, createEditor } from 'lexical'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bundledAgentSkills } from '../agent-skills/bundled'
import { buildDynamicTools, DYNAMIC_PREVIEW_TOOL } from './dynamic-tools'

const source =
  'export default { mount(container) { return { unmount() { container.replaceChildren() } } } }'

function editorWithComponent(blockId: string) {
  const editor = createEditor({
    nodes: [DynamicEditNode],
    onError: (error) => {
      throw error
    },
  })
  editor.update(
    () => {
      const node = $createDynamicEditNode({
        url: 'https://files.example/v1.js',
        props: {},
        initialHeight: 240,
      })
      $setState(node, blockIdState, blockId)
      $getRoot().append(node)
    },
    { discrete: true },
  )
  return editor
}

function toolsFor(editor: LexicalEditor) {
  const tools = buildDynamicTools(() => editor)
  const byName = (name: string) => tools.find((tool) => tool.name === name)!
  return {
    preview: (params: Record<string, unknown>) =>
      byName(DYNAMIC_PREVIEW_TOOL).execute({
        name: 'Figure',
        source,
        ...params,
      }),
    read: (blockId: string) =>
      byName('read_dynamic_component').execute({ blockId }),
  }
}

describe('buildDynamicTools', () => {
  it('tells the agent to load the design skill before writing a component', () => {
    const preview = buildDynamicTools().find(
      (tool) => tool.name === DYNAMIC_PREVIEW_TOOL,
    )
    const skill = 'dynamic-component-design'
    expect(bundledAgentSkills.map((entry) => entry.name)).toContain(skill)
    expect(preview?.description).toContain(`load_skill with "${skill}"`)
  })
})

describe('preview_dynamic_component after reading a component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(source, { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses a draft without target and names the block to revise', async () => {
    const tools = toolsFor(editorWithComponent('first'))
    expect((await tools.read('first')).ok).toBe(true)

    const result = await tools.preview({})

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.error).toBe('missing_target')
    expect(result.error.message).toContain('first')
    expect(result.error.message).toContain('newComponent')
  })

  it('accepts the draft once the read target is passed', async () => {
    const tools = toolsFor(editorWithComponent('first'))
    const read = await tools.read('first')
    if (!read.ok) throw new Error('read failed')
    const { target } = JSON.parse(read.content)

    expect((await tools.preview({ target })).ok).toBe(true)
  })

  it('accepts a separate new component when newComponent is set', async () => {
    const tools = toolsFor(editorWithComponent('first'))
    await tools.read('first')

    expect((await tools.preview({ newComponent: true })).ok).toBe(true)
  })

  it('accepts a draft without target when no component was read', async () => {
    const tools = toolsFor(editorWithComponent('first'))

    expect((await tools.preview({})).ok).toBe(true)
  })

  it('stops requiring the target once the read block is gone', async () => {
    const editor = editorWithComponent('first')
    const tools = toolsFor(editor)
    await tools.read('first')
    editor.update(() => $getRoot().clear(), { discrete: true })

    expect((await tools.preview({})).ok).toBe(true)
  })
})
