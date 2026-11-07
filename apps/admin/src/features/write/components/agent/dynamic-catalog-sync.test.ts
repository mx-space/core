import type { SerializedLexicalNode } from 'lexical'
import { describe, expect, it, vi } from 'vitest'

import { createDynamicCatalogSync } from './dynamic-catalog-sync'

const PARENT = 'https://cdn.example.test/versions/v1.js'
const NEXT = 'https://cdn.example.test/versions/v2.js'

const parentEntry = {
  id: 'e1',
  name: 'Chart',
  description: 'Bars',
  url: PARENT,
  initialHeight: 320,
  propsSchema: { type: 'object' },
}

const dynamicNode = (url: string) =>
  ({
    type: 'dynamic',
    version: 1,
    url,
    props: {},
    initialHeight: 400,
  }) as unknown as SerializedLexicalNode

function setup(pending: Record<string, unknown> = {}) {
  const catalog = {
    resolveCatalogUrl: vi.fn(async (url: string) =>
      url === PARENT ? { entry: parentEntry, outdated: false } : null,
    ),
    reviseDynamicComponent: vi.fn(async () => {}),
    registerDynamicComponent: vi.fn(async () => {}),
  }
  const sync = createDynamicCatalogSync({
    catalog,
    pendingDynamic: (url) => (pending[url] as never) ?? null,
  })
  return { sync, catalog }
}

describe('createDynamicCatalogSync', () => {
  it('reads catalog metadata for a component URL', async () => {
    const { sync } = setup()

    expect(await sync.read(PARENT)).toEqual({
      name: 'Chart',
      description: 'Bars',
      propsSchema: { type: 'object' },
    })
    expect(await sync.read('https://cdn.example.test/other.js')).toBeNull()
  })

  it('writes metadata edits onto the cataloged entry', async () => {
    const { sync, catalog } = setup()

    await sync.save(PARENT, { description: 'Stacked bars' })

    expect(catalog.reviseDynamicComponent).toHaveBeenCalledWith(parentEntry, {
      description: 'Stacked bars',
    })
  })

  it('registers an accepted new version as a revision of its parent', async () => {
    const { sync, catalog } = setup({
      [NEXT]: { parentUrl: PARENT, meta: { name: 'Chart' } },
    })

    await sync.register([dynamicNode(NEXT)])
    await sync.register([dynamicNode(NEXT)])

    expect(catalog.reviseDynamicComponent).toHaveBeenCalledTimes(1)
    expect(catalog.reviseDynamicComponent).toHaveBeenCalledWith(parentEntry, {
      url: NEXT,
      parentUrl: PARENT,
      initialHeight: 400,
      name: 'Chart',
    })
  })

  it('registers a brand-new component with its metadata', async () => {
    const { sync, catalog } = setup({
      [NEXT]: {
        meta: { name: 'Timeline', description: 'Events', propsSchema: {} },
      },
    })

    await sync.register([dynamicNode(NEXT)])

    expect(catalog.registerDynamicComponent).toHaveBeenCalledWith({
      parentUrl: undefined,
      name: 'Timeline',
      description: 'Events',
      url: NEXT,
      initialHeight: 400,
      propsSchema: {},
    })
  })

  it('ignores components it did not upload', async () => {
    const { sync, catalog } = setup()

    await sync.register([dynamicNode(PARENT)])

    expect(catalog.registerDynamicComponent).not.toHaveBeenCalled()
    expect(catalog.reviseDynamicComponent).not.toHaveBeenCalled()
  })
})
