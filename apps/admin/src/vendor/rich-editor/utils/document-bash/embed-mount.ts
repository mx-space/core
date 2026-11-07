import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

import {
  extensionOf,
  hash8,
  mediaMetadata,
  MIME,
  parseScene,
  type Slot,
  slotsOf,
  tryParseJson,
} from './embed-slots'
import {
  hideSceneFiles,
  hideSceneFilesInText,
  restoreSceneFiles,
} from './scene-files'

export const EMBEDS_DIR = '/embeds'

type UploadKind = 'excalidraw' | 'dynamic'

export interface EmbedUpload {
  path: string
  kind: UploadKind
  content: string
  assetKey: string
  parentUrl?: string
}

export interface EmbedMountOptions {
  isOwnUrl: (url: string) => boolean
  resolveUrl?: (ref: string) => string
  fetchText: (url: string) => Promise<string>
  applyDelta: (base: unknown, delta: unknown) => Promise<unknown>
  upload: (file: EmbedUpload) => Promise<string>
  canUpload: () => boolean
  getCurrentRef: (blockId: string) => string | null
  createAssetKey: () => string
  transformScene?: (next: string, previous: string | null) => Promise<string>
  dynamicMeta?: {
    read: (url: string) => Promise<DynamicMeta | null>
    save: (url: string, meta: DynamicMeta) => Promise<void>
  }
}

export type DynamicMeta = Record<string, unknown>

export interface PendingDynamic {
  parentUrl?: string
  meta: DynamicMeta
}

export interface EmbedView {
  state: SerializedEditorState
  files: Record<string, string>
  readonly: string[]
  versions: Record<string, string>
}

type Storage = 'remote' | 'delta' | 'inline' | 'media'

interface Entry {
  path: string
  kind: UploadKind | 'media'
  storage: Storage
  blockId?: string
  source: string
  sourceUrl: string | null
  seeded: string
  metaSeeded?: string
  ours: Set<string>
}

type Loaded = { ok: true; text: string } | { ok: false; error: string }

export interface EmbedReport {
  notices: string[]
  files: Record<string, string>
  view: SerializedEditorState | null
}

type Resolved = { ref: string } | { conflict: Entry; current: string }

const emptyReport = (): EmbedReport => ({ notices: [], files: {}, view: null })

const metaPathOf = (path: string) => path.replace(/\.js$/, '.meta.json')

const versionText = (entry: Entry) =>
  `version ${entry.sourceUrl ?? entry.source}`

export function createEmbedMount(options: EmbedMountOptions) {
  const resolveUrl = options.resolveUrl ?? ((ref: string) => ref)
  const fetched = new Map<string, Promise<Loaded>>()
  const loaded = new Map<string, Loaded>()
  const uploaded = new Map<string, string>()
  let entries = new Map<string, Entry>()
  let bases = new Map<string, Entry>()
  let report = emptyReport()
  const metas = new Map<string, DynamicMeta | null>()
  const savedMeta = new Map<string, string>()
  const pending = new Map<string, PendingDynamic>()
  const fileData = new Map<string, string>()
  const sceneText = (data: unknown) =>
    JSON.stringify(hideSceneFiles(data, fileData), null, 2)

  const isOwn = (url: string) => url.startsWith('ref:') || options.isOwnUrl(url)

  const fetchOnce = (url: string) => {
    let pending = fetched.get(url)
    if (!pending) {
      pending = options
        .fetchText(resolveUrl(url))
        .then((text): Loaded => ({ ok: true, text }))
        .catch((error): Loaded => ({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }))
      fetched.set(url, pending)
    }
    return pending
  }

  const loadScene = async (snapshot: string): Promise<Loaded | null> => {
    const parsed = parseScene(snapshot)
    if (parsed.storage === 'inline')
      return { ok: true, text: sceneText(parsed.data) }
    if (!isOwn(parsed.url)) return null
    const base = await fetchOnce(parsed.url)
    if (!base.ok) return base
    try {
      const data =
        parsed.storage === 'delta'
          ? await options.applyDelta(JSON.parse(base.text), parsed.delta)
          : JSON.parse(base.text)
      return { ok: true, text: sceneText(data) }
    } catch (error) {
      return { ok: false, error: `Invalid drawing data: ${String(error)}` }
    }
  }

  const prefetch = async (state: SerializedEditorState) => {
    await Promise.all(
      slotsOf(state).map(async (slot) => {
        const value = slot.get()
        if (loaded.has(value) || value.startsWith(`${EMBEDS_DIR}/`)) return
        const result =
          slot.kind === 'excalidraw'
            ? await loadScene(value)
            : slot.kind === 'dynamic' && isOwn(value)
              ? await fetchOnce(value)
              : null
        if (result) loaded.set(value, result)
        if (slot.kind === 'dynamic' && options.dynamicMeta && !metas.has(value))
          metas.set(
            value,
            await options.dynamicMeta.read(value).catch(() => null),
          )
      }),
    )
  }

  const toView = (
    state: SerializedEditorState,
    { remember = true }: { remember?: boolean } = {},
  ): EmbedView => {
    const claimed = new Map<string, Entry>()
    const view = structuredClone(state)
    const files: Record<string, string> = {}
    const readonly: string[] = []
    const claim = (name: string, ext: string) => {
      let path = `${EMBEDS_DIR}/${name}.${ext}`
      for (let n = 2; claimed.has(path) || path in files; n++)
        path = `${EMBEDS_DIR}/${name}-${n}.${ext}`
      return path
    }

    for (const slot of slotsOf(view)) {
      const source = slot.get()
      if (slot.kind === 'media') {
        if (!isOwn(source)) continue
        const path = claim(slot.blockId ?? hash8(source), extensionOf(source))
        files[path] = mediaMetadata(slot.node, source)
        readonly.push(path)
        claimed.set(path, {
          path,
          kind: 'media',
          storage: 'media',
          blockId: slot.blockId,
          source,
          sourceUrl: source,
          seeded: files[path],
          ours: new Set(),
        })
        slot.set(path)
        continue
      }
      const result = loaded.get(source)
      if (!result) continue
      const name = slot.blockId ?? hash8(source)
      if (!result.ok) {
        const path = claim(name, 'error')
        files[path] = `${result.error}\n`
        readonly.push(path)
        continue
      }
      const scene = slot.kind === 'excalidraw' ? parseScene(source) : null
      const path = claim(name, slot.kind === 'excalidraw' ? 'excalidraw' : 'js')
      files[path] = result.text
      claimed.set(path, {
        path,
        kind: slot.kind,
        storage: scene?.storage ?? 'remote',
        blockId: slot.blockId,
        source,
        sourceUrl: scene
          ? scene.storage === 'inline'
            ? null
            : scene.url
          : source,
        seeded: result.text,
        ours: new Set(),
      })
      if (slot.kind === 'dynamic' && options.dynamicMeta) {
        const metaPath = metaPathOf(path)
        files[metaPath] =
          `${JSON.stringify(metas.get(source) ?? {}, null, 2)}\n`
        claimed.get(path)!.metaSeeded = files[metaPath]
      }
      slot.set(path)
    }
    if (remember) {
      entries = claimed
      bases = new Map(
        [...claimed.values()]
          .filter((entry) => entry.blockId && entry.kind !== 'media')
          .map((entry) => [entry.blockId!, entry]),
      )
    }
    const versions = Object.fromEntries(
      [...claimed.values()].map((entry) => [entry.path, versionText(entry)]),
    )
    return { state: view, files, readonly, versions }
  }

  const viewNode = (node: SerializedLexicalNode) =>
    toView(
      {
        root: {
          type: 'root',
          version: 1,
          children: [node],
          direction: null,
          format: '',
          indent: 0,
        },
      } as SerializedEditorState,
      { remember: false },
    ).state.root.children[0]

  const uploadOnce = async (
    kind: UploadKind,
    path: string,
    content: string,
    parentUrl?: string,
  ) => {
    const key = `${kind}\n${parentUrl ?? ''}\n${content}`
    const done = uploaded.get(key)
    if (done) return done
    const url = await options.upload({
      path,
      kind,
      content,
      assetKey: options.createAssetKey(),
      parentUrl,
    })
    uploaded.set(key, url)
    loaded.set(url, {
      ok: true,
      text:
        kind === 'excalidraw'
          ? hideSceneFilesInText(content, fileData)
          : content,
    })
    return url
  }

  const resolveSlot = async (
    slot: Slot,
    path: string,
    readFile: (path: string) => Promise<string | null>,
  ): Promise<Resolved> => {
    const content = await readFile(path)
    if (content === null)
      throw new Error(`${path} does not exist; create it or use another path.`)
    const entry = entries.get(path)
    if (slot.kind === 'media' || entry?.kind === 'media') {
      if (entry?.kind !== 'media' || slot.kind !== 'media')
        throw new Error(`${path} cannot be used in this block.`)
      return { ref: entry.source }
    }
    if (entry && content === entry.seeded) return { ref: entry.source }
    const base = slot.blockId ? bases.get(slot.blockId) : undefined
    if (base) {
      const current = options.getCurrentRef(slot.blockId!)
      if (
        current !== null &&
        current !== base.source &&
        !base.ours.has(current)
      )
        return { conflict: base, current }
    }
    const origin = entry ?? base

    if (slot.kind === 'excalidraw') {
      try {
        JSON.parse(content)
      } catch {
        throw new Error(`${path} is not valid JSON; the drawing was not saved.`)
      }
    }
    const full =
      slot.kind === 'excalidraw'
        ? restoreSceneFiles(content, fileData, path)
        : content
    const next =
      slot.kind === 'excalidraw' && options.transformScene
        ? await options.transformScene(full, origin?.seeded ?? null)
        : full
    if (origin?.storage === 'inline')
      return { ref: JSON.stringify(JSON.parse(next)) }
    if (!options.canUpload())
      throw new Error(
        `${path} is read-only here: you cannot upload files in this editor.`,
      )
    const url = await uploadOnce(
      slot.kind,
      path,
      next,
      origin?.sourceUrl ?? undefined,
    )
    origin?.ours.add(url)
    return { ref: url }
  }

  const reseed = async (base: Entry, current: string) => {
    const notice = `${base.path} was changed by someone else during this turn; your edit to it was not applied.`
    const result =
      base.kind === 'excalidraw'
        ? await loadScene(current)
        : isOwn(current)
          ? await fetchOnce(current)
          : null
    if (!result?.ok) {
      report.notices.push(
        `${notice} Their version could not be loaded${result ? `: ${result.error}` : ''}.`,
      )
      return
    }
    const scene = base.kind === 'excalidraw' ? parseScene(current) : null
    loaded.set(current, result)
    Object.assign(base, {
      source: current,
      storage: scene?.storage ?? 'remote',
      sourceUrl: scene
        ? scene.storage === 'inline'
          ? null
          : scene.url
        : current,
      seeded: result.text,
      ours: new Set(),
    })
    report.files[base.path] = result.text
    report.notices.push(`${notice} ${base.path} now holds their version.`)
  }

  const resolveMeta = async (
    path: string,
    url: string,
    readFile: (path: string) => Promise<string | null>,
  ) => {
    if (!options.dynamicMeta) return
    const entry = entries.get(path)
    const metaPath = metaPathOf(path)
    const text = await readFile(metaPath)
    const meta = text === null ? null : tryParseJson(text)
    if (
      text !== null &&
      (!meta || typeof meta !== 'object' || Array.isArray(meta))
    )
      throw new Error(`${metaPath} must be a JSON object.`)
    const changedMeta = text !== null && text !== entry?.metaSeeded
    if (entry && url === entry.source) {
      if (!changedMeta || savedMeta.get(url) === text) return
      await options.dynamicMeta.save(url, meta as DynamicMeta)
      savedMeta.set(url, text!)
      report.notices.push(`${metaPath} was saved to the component catalog.`)
      return
    }
    const resolved =
      (meta as DynamicMeta | null) ??
      (entry ? (metas.get(entry.source) ?? {}) : {})
    pending.set(url, {
      parentUrl: entry?.sourceUrl ?? undefined,
      meta: resolved,
    })
    metas.set(url, resolved)
  }

  const fromView = async (
    view: SerializedEditorState,
    readFile: (path: string) => Promise<string | null>,
  ) => {
    report = emptyReport()
    const state = structuredClone(view)
    const viewCopy = structuredClone(view)
    const viewSlots = slotsOf(viewCopy)
    const errors: string[] = []
    await Promise.all(
      slotsOf(state).map(async (slot, index) => {
        const value = slot.get()
        if (!value.startsWith(`${EMBEDS_DIR}/`)) return
        try {
          const resolved = await resolveSlot(slot, value, readFile)
          if ('conflict' in resolved) {
            slot.set(resolved.current)
            await reseed(resolved.conflict, resolved.current)
            if (value !== resolved.conflict.path) {
              viewSlots[index].set(resolved.conflict.path)
              report.view = viewCopy
            }
            return
          }
          slot.set(resolved.ref)
          if (slot.kind === 'dynamic')
            await resolveMeta(value, resolved.ref, readFile)
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error))
        }
      }),
    )
    if (errors.length) throw new Error(errors.join('\n'))
    return state
  }

  const registerMedia = (url: string, name: string) => {
    const slug =
      name
        .toLowerCase()
        .replaceAll(/[^\da-z]+/g, '-')
        .replaceAll(/^-+|-+$/g, '') || hash8(url)
    const ext = extensionOf(url)
    let path = `${EMBEDS_DIR}/${slug}.${ext}`
    for (let n = 2; entries.has(path); n++)
      path = `${EMBEDS_DIR}/${slug}-${n}.${ext}`
    const content = mediaMetadata({ type: 'image' }, url)
    entries.set(path, {
      path,
      kind: 'media',
      storage: 'media',
      source: url,
      sourceUrl: url,
      seeded: content,
      ours: new Set(),
    })
    return { path, content }
  }

  const imageOf = (path: string) => {
    const entry = entries.get(path)
    if (entry?.kind !== 'media') return null
    const mimeType = MIME[extensionOf(entry.source)]
    return mimeType?.startsWith('image/')
      ? { url: entry.source, mimeType }
      : null
  }

  const versionOf = (path: string) => {
    const entry = entries.get(path)
    return entry ? versionText(entry) : null
  }

  return {
    prefetch,
    toView,
    viewNode,
    fromView,
    imageOf,
    registerMedia,
    pendingDynamic: (url: string) => pending.get(url) ?? null,
    versionOf,
    takeReport: () => {
      const taken = report
      report = emptyReport()
      return taken
    },
    canUpload: options.canUpload,
  }
}

export type EmbedMount = ReturnType<typeof createEmbedMount>
