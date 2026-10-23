// @vitest-environment node

import type { ToolCallGroupItem } from '@haklex/rich-agent-core'
import { createAgentStore } from '@haklex/rich-agent-core'
import { blockIdState } from '@haklex/rich-editor'
import {
  $createDynamicEditNode,
  $isDynamicNode,
  DynamicEditNode,
} from '@haklex/rich-ext-dynamic'
import type { LexicalEditor } from 'lexical'
import { $getRoot, $setState, createEditor } from 'lexical'
import { beforeEach, expect, it, vi } from 'vitest'

import {
  buildDynamicTools,
  readDynamicDraft,
  readDynamicReceipt,
  readDynamicTarget,
} from '~/vendor/rich-editor/utils/dynamic-tools'

import { createDynamicPublisher } from './publish-dynamic-component'

const uploadFile = vi.fn()
const registerDynamicComponent = vi.fn()
const reviseDynamicComponent = vi.fn()
const resolveCatalogUrl = vi.fn()
vi.mock('~/api/files', () => ({
  uploadFile: (...args: unknown[]) => uploadFile(...args),
}))
vi.mock('~/vendor/rich-editor/utils/dynamic-catalog', () => ({
  registerDynamicComponent: (...args: unknown[]) =>
    registerDynamicComponent(...args),
  resolveCatalogUrl: (url: string) => resolveCatalogUrl(url),
  reviseDynamicComponent: (...args: unknown[]) =>
    reviseDynamicComponent(...args),
}))
vi.mock('~/i18n/translate', () => ({ translate: (key: string) => key }))

beforeEach(() => {
  vi.resetAllMocks()
  uploadFile.mockResolvedValue({ url: 'https://files.example/widget.js' })
  registerDynamicComponent.mockResolvedValue(undefined)
  resolveCatalogUrl.mockResolvedValue(null)
})

async function setup(extra: Record<string, unknown> = {}) {
  const tool = buildDynamicTools()[0]
  const params = {
    name: 'Counter',
    source:
      'export default { mount(container) { container.textContent = "Counter"; return { unmount() { container.replaceChildren() } } } }',
    props: { start_count: 3 },
    initialHeight: 240,
    ...extra,
  }
  const result = await tool.execute(params)
  if (!result.ok) throw new Error('tool failed')
  const item: ToolCallGroupItem = {
    id: 'draft-1',
    toolName: tool.name,
    params,
    status: 'completed',
    result: result.content,
  }
  const store = createAgentStore()
  store.setState({
    bubbles: [{ type: 'tool_call_group', id: 'group-1', items: [item] }],
    status: 'idle',
  })
  const dispatchCommand = vi.fn().mockReturnValue(true)
  const editor = { dispatchCommand } as unknown as LexicalEditor
  return {
    item,
    store,
    dispatchCommand,
    publish: createDynamicPublisher(store, () => editor),
    current: () => {
      const bubble = store.getState().bubbles[0]
      if (bubble.type !== 'tool_call_group') throw new Error('missing group')
      return bubble.items[0]
    },
  }
}

it('rejects invalid tool inputs and keeps a valid draft serializable without uploading', async () => {
  const tool = buildDynamicTools()[0]
  for (const params of [
    null,
    {},
    { name: 'x', source: '' },
    { name: 'x', source: 'export default {}', props: [] },
    { name: 'x', source: 'x', initialHeight: -1 },
    { name: 'x', source: 'x', propsSchema: [] },
  ]) {
    expect((await tool.execute(params)).ok).toBe(false)
  }
  const { item, dispatchCommand } = await setup()
  const serialized = JSON.stringify(item)
  const restored = JSON.parse(serialized)
  // The HTTP client camel-cases object keys, but must not alter artifact data.
  restored.params.props = { startCount: 3 }
  expect(readDynamicDraft(restored)?.props).toEqual({
    start_count: 3,
  })
  expect(uploadFile).not.toHaveBeenCalled()
  expect(dispatchCommand).not.toHaveBeenCalled()
})

it('uploads the exact preview source, registers it, then inserts once', async () => {
  const { item, current, publish, dispatchCommand } = await setup()
  await publish(item)
  expect(await (uploadFile.mock.calls[0][0] as File).text()).toBe(
    item.params.source,
  )
  expect(registerDynamicComponent).toHaveBeenCalledWith(
    expect.objectContaining({
      url: 'https://files.example/widget.js',
      name: 'Counter',
    }),
  )
  expect(dispatchCommand).toHaveBeenCalledWith(expect.anything(), {
    url: 'https://files.example/widget.js',
    props: { start_count: 3 },
    initialHeight: 240,
  })
  expect(readDynamicReceipt(current()).inserted).toBe(true)
  await publish(current())
  expect(dispatchCommand).toHaveBeenCalledTimes(1)
  expect(uploadFile).toHaveBeenCalledTimes(1)
})

it('registers a new component with the description and props schema the agent wrote', async () => {
  const propsSchema = {
    type: 'object',
    properties: { start_count: { type: 'integer', default: 0 } },
  }
  const { item, publish } = await setup({
    description: 'Click counter. Use to let readers count along.',
    propsSchema,
  })

  await publish(item)

  expect(registerDynamicComponent).toHaveBeenCalledWith(
    expect.objectContaining({
      description: 'Click counter. Use to let readers count along.',
      propsSchema,
    }),
  )
})

it('leaves the document alone on upload failure and reuses a successful upload when catalog registration is retried', async () => {
  const { item, current, publish, dispatchCommand } = await setup()
  uploadFile.mockRejectedValueOnce(new Error('offline'))
  await expect(publish(item)).rejects.toThrow('offline')
  expect(dispatchCommand).not.toHaveBeenCalled()
  registerDynamicComponent.mockRejectedValueOnce(
    new Error('catalog unavailable'),
  )
  await expect(publish(item)).rejects.toThrow('catalog unavailable')
  expect(dispatchCommand).not.toHaveBeenCalled()
  expect(readDynamicReceipt(current()).url).toBe(
    'https://files.example/widget.js',
  )
  await publish(current())
  expect(uploadFile).toHaveBeenCalledTimes(2)
  expect(dispatchCommand).toHaveBeenCalledTimes(1)
})

it('blocks duplicate clicks and never inserts into a switched conversation', async () => {
  const { item, store, publish, dispatchCommand } = await setup()
  let finish!: (value: { url: string }) => void
  uploadFile.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const pending = publish(item)
  await expect(publish(item)).rejects.toThrow('busy')
  store.getState().reset()
  finish({ url: 'https://files.example/widget.js' })
  await expect(pending).rejects.toThrow('contextChanged')
  expect(dispatchCommand).not.toHaveBeenCalled()
  expect(store.getState().bubbles).toEqual([])
})

it('reads an existing version, replaces only its block, and rejects stale proposals', async () => {
  const editor = createEditor({
    nodes: [DynamicEditNode],
    onError: (error) => {
      throw error
    },
  })
  editor.update(
    () => {
      for (const blockId of ['first', 'second']) {
        const node = $createDynamicEditNode({
          url: 'https://files.example/v1.js',
          props: { start_count: 3 },
          initialHeight: 240,
        })
        $setState(node, blockIdState, blockId)
        $getRoot().append(node)
      }
    },
    { discrete: true },
  )
  const publishedState = editor.getEditorState().toJSON()
  editor.setEditorState(editor.parseEditorState(publishedState))
  expect(readDynamicTarget(editor, 'first').url).toBe(
    'https://files.example/v1.js',
  )
  const parentSchema = { properties: { start_count: { type: 'number' } } }
  resolveCatalogUrl.mockImplementation(async (url: string) =>
    url === 'https://files.example/v1.js'
      ? {
          entry: {
            name: 'Counter',
            description: 'Counts clicks',
            url: 'https://files.example/v0.js',
            initialHeight: 240,
            propsSchema: parentSchema,
          },
          outdated: true,
        }
      : null,
  )
  const fetchMock = vi.fn().mockResolvedValue(new Response('export default {}'))
  vi.stubGlobal('fetch', fetchMock)
  try {
    const [preview, read] = buildDynamicTools(() => editor)
    const result = await read.execute({ blockId: 'first' })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('read failed')
    const { target, source } = JSON.parse(result.content)
    expect(source).toBe('export default {}')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ credentials: 'omit' }),
    )
    const params = {
      target,
      name: 'Counter v2',
      source: 'export default { mount() {} }',
      props: { start_count: 10 },
      initialHeight: 300,
    }
    const proposal = await preview.execute(params)
    if (!proposal.ok) throw new Error('preview failed')
    const item: ToolCallGroupItem = {
      id: 'revision',
      toolName: preview.name,
      params,
      status: 'completed',
      result: proposal.content,
    }
    const store = createAgentStore()
    store.setState({
      bubbles: [{ type: 'tool_call_group', id: 'group', items: [item] }],
      status: 'idle',
    })
    const publish = createDynamicPublisher(store, () => editor)
    await publish(item)
    expect(readDynamicTarget(editor, 'first')).toMatchObject({
      url: 'https://files.example/widget.js',
      props: { start_count: 10 },
      initialHeight: 300,
    })
    expect(readDynamicTarget(editor, 'second').url).toBe(target.url)
    expect(publishedState.root.children).toHaveLength(2)
    expect(JSON.stringify(publishedState)).not.toContain('widget.js')
    expect(editor.getEditorState().toJSON().root.children).toHaveLength(2)
    expect(registerDynamicComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Counts clicks',
        parentUrl: target.url,
        propsSchema: parentSchema,
      }),
    )
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), 'file', true)
    expect((await preview.execute(params)).ok).toBe(false)
    store.setState({
      bubbles: [{ type: 'tool_call_group', id: 'group', items: [item] }],
    })
    await expect(publish(item)).rejects.toThrow('targetChanged')
    expect(uploadFile).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
  }
})

async function setupRevision(params: Record<string, unknown> = {}) {
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
      $setState(node, blockIdState, 'block')
      $getRoot().append(node)
    },
    { discrete: true },
  )
  const [preview] = buildDynamicTools(() => editor)
  const fullParams = {
    target: readDynamicTarget(editor, 'block'),
    name: 'Counter v2',
    source: 'export default { mount() {} }',
    initialHeight: 300,
    ...params,
  }
  const proposal = await preview.execute(fullParams)
  if (!proposal.ok) throw new Error('preview failed')
  const item: ToolCallGroupItem = {
    id: 'revision',
    toolName: preview.name,
    params: fullParams,
    status: 'completed',
    result: proposal.content,
  }
  const store = createAgentStore()
  store.setState({
    bubbles: [{ type: 'tool_call_group', id: 'group', items: [item] }],
    status: 'idle',
  })
  return {
    editor,
    publish: () => createDynamicPublisher(store, () => editor)(item),
  }
}

const catalogEntry = {
  id: '7',
  name: 'Counter',
  description: 'Counts clicks',
  url: 'https://files.example/v1.js',
  initialHeight: 240,
  propsSchema: {},
}

it('saves a revision of the current catalog version as a new version of that entry', async () => {
  resolveCatalogUrl.mockResolvedValue({ entry: catalogEntry, outdated: false })
  const propsSchema = { properties: { step: { type: 'number' } } }
  const { editor, publish } = await setupRevision({ propsSchema })

  await publish()

  expect(reviseDynamicComponent).toHaveBeenCalledWith(catalogEntry, {
    url: 'https://files.example/widget.js',
    parentUrl: catalogEntry.url,
    initialHeight: 300,
    propsSchema,
  })
  expect(registerDynamicComponent).not.toHaveBeenCalled()
  expect(readDynamicTarget(editor, 'block').url).toBe(
    'https://files.example/widget.js',
  )
})

it('skips the catalog write when a retried adoption already moved the entry to the upload', async () => {
  resolveCatalogUrl.mockResolvedValue({
    entry: { ...catalogEntry, url: 'https://files.example/widget.js' },
    outdated: true,
  })
  const { editor, publish } = await setupRevision()

  await publish()

  expect(reviseDynamicComponent).not.toHaveBeenCalled()
  expect(registerDynamicComponent).not.toHaveBeenCalled()
  expect(readDynamicTarget(editor, 'block').url).toBe(
    'https://files.example/widget.js',
  )
})

it('lifts draft fields a model nested inside propsSchema back to the top level', async () => {
  const tool = buildDynamicTools()[0]
  const source = 'export default { mount() {} }'

  const result = await tool.execute({
    name: 'Counter',
    description: 'Counts clicks',
    propsSchema: {
      type: 'object',
      properties: { step: { type: 'number' } },
      props: { step: 2 },
      initialHeight: 400,
      source,
    },
  })

  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('tool failed')
  expect(JSON.parse(result.content).draft).toMatchObject({
    source,
    props: { step: 2 },
    initialHeight: 400,
    propsSchema: { type: 'object', properties: { step: { type: 'number' } } },
  })
  expect(JSON.parse(result.content).draft.propsSchema).not.toHaveProperty(
    'source',
  )
})

it('accepts a revision whose target carries edited props, matching the block by id and url', async () => {
  resolveCatalogUrl.mockResolvedValue(null)
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
        props: { years: 20 },
        initialHeight: 240,
      })
      $setState(node, blockIdState, 'block')
      $getRoot().append(node)
    },
    { discrete: true },
  )
  const [preview] = buildDynamicTools(() => editor)

  const result = await preview.execute({
    target: {
      ...readDynamicTarget(editor, 'block'),
      props: { years: 30 },
      initialHeight: 300,
    },
    name: 'Counter',
    source: 'export default { mount() {} }',
    props: { years: 30 },
  })

  expect(result.ok).toBe(true)
})

it('still adopts a revision after the writer tweaked the block props', async () => {
  resolveCatalogUrl.mockResolvedValue({ entry: catalogEntry, outdated: false })
  const { editor, publish } = await setupRevision({ props: { step: 5 } })
  editor.update(
    () => {
      const node = $getRoot().getFirstChild()
      if (!$isDynamicNode(node)) throw new Error('missing node')
      node.setProps({ step: 9 })
    },
    { discrete: true },
  )

  await publish()

  expect(readDynamicTarget(editor, 'block')).toMatchObject({
    url: 'https://files.example/widget.js',
    props: { step: 5 },
  })
})
