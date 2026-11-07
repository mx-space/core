import type {
  DynamicMeta,
  PendingDynamic,
} from '~/vendor/rich-editor/utils/document-bash/embed-mount'
import {
  type DynamicCatalogEntry,
  registerDynamicComponent,
  resolveCatalogUrl,
  reviseDynamicComponent,
} from '~/vendor/rich-editor/utils/dynamic-catalog'

type CatalogApi = {
  resolveCatalogUrl: typeof resolveCatalogUrl
  reviseDynamicComponent: typeof reviseDynamicComponent
  registerDynamicComponent: typeof registerDynamicComponent
}

function pickMeta(meta: DynamicMeta) {
  const picked: Partial<
    Pick<DynamicCatalogEntry, 'name' | 'description' | 'propsSchema'>
  > = {}
  if (typeof meta.name === 'string' && meta.name.trim())
    picked.name = meta.name.trim()
  if (typeof meta.description === 'string' && meta.description.trim())
    picked.description = meta.description.trim()
  if (meta.propsSchema && typeof meta.propsSchema === 'object')
    picked.propsSchema = meta.propsSchema as Record<string, unknown>
  return picked
}

function collectDynamicNodes(value: unknown, out: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    for (const item of value) collectDynamicNodes(item, out)
    return
  }
  if (!value || typeof value !== 'object') return
  const node = value as Record<string, unknown>
  if (node.type === 'dynamic' && typeof node.url === 'string') out.push(node)
  for (const child of Object.values(node)) {
    if (child && typeof child === 'object') collectDynamicNodes(child, out)
  }
}

export function createDynamicCatalogSync(deps: {
  pendingDynamic: (url: string) => PendingDynamic | null
  catalog?: CatalogApi
}) {
  const catalog = deps.catalog ?? {
    resolveCatalogUrl,
    reviseDynamicComponent,
    registerDynamicComponent,
  }
  const registered = new Set<string>()

  const read = async (url: string): Promise<DynamicMeta | null> => {
    const resolved = await catalog.resolveCatalogUrl(url)
    if (!resolved) return null
    const { name, description, propsSchema } = resolved.entry
    return { name, description, propsSchema }
  }

  const save = async (url: string, meta: DynamicMeta) => {
    const resolved = await catalog.resolveCatalogUrl(url)
    const fields = pickMeta(meta)
    if (resolved?.entry.id) {
      await catalog.reviseDynamicComponent(
        { ...resolved.entry, id: resolved.entry.id },
        fields,
      )
      return
    }
    await catalog.registerDynamicComponent({
      name: fields.name ?? 'Component',
      description: fields.description ?? fields.name ?? 'Component',
      url,
      initialHeight: 320,
      propsSchema: fields.propsSchema ?? {},
    })
  }

  const registerOne = async (node: Record<string, unknown>) => {
    const url = node.url as string
    const info = deps.pendingDynamic(url)
    if (!info || registered.has(url)) return
    registered.add(url)
    const initialHeight =
      typeof node.initialHeight === 'number' ? node.initialHeight : 320
    const fields = pickMeta(info.meta)
    const resolved = info.parentUrl
      ? await catalog.resolveCatalogUrl(info.parentUrl)
      : null
    const parent = resolved?.entry
    if (parent?.url === url) return
    if (parent?.id && !resolved?.outdated) {
      await catalog.reviseDynamicComponent(
        { ...parent, id: parent.id },
        { url, parentUrl: parent.url, initialHeight, ...fields },
      )
      return
    }
    const name = fields.name ?? parent?.name ?? 'Component'
    await catalog.registerDynamicComponent({
      parentUrl: info.parentUrl,
      name,
      description: fields.description ?? parent?.description ?? name,
      url,
      initialHeight,
      propsSchema: fields.propsSchema ?? parent?.propsSchema ?? {},
    })
  }

  const register = async (nodes: unknown) => {
    const found: Record<string, unknown>[] = []
    collectDynamicNodes(nodes, found)
    for (const node of found) {
      try {
        await registerOne(node)
      } catch (error) {
        registered.delete(node.url as string)
        throw error
      }
    }
  }

  return { read, save, register }
}
