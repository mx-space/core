import {
  $reconcileRoot,
  createLoroBinding,
  TREE_NAME,
} from '@haklex/rich-collab-loro'
import { allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import {
  $getRoot,
  $getState,
  $setState,
  createState,
  DecoratorNode,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedEditorState,
  type SerializedLexicalNode,
} from 'lexical'
import {
  LoroDoc,
  LoroList,
  LoroMap,
  type LoroTreeNode,
  type OpId,
  type TreeID,
} from 'loro-crdt'

export type Frontiers = ReturnType<LoroDoc['frontiers']>
export type PeerId = Parameters<LoroDoc['setPeerId']>[0]

export type FieldsSection = 'meta' | 'typeSpecificData'

export type DocFields = Record<FieldsSection, Record<string, unknown> | null>

export type DocFieldsPatch = Partial<
  Record<FieldsSection, Record<string, unknown> | null>
>

export interface DocContent {
  content: string
  title: string
  fields?: DocFields
}

const TITLE = 'title'
export const FIELDS = 'fields'
const SECTIONS: FieldsSection[] = ['meta', 'typeSpecificData']

// Co-authors receive the whole doc, so secrets stay in the database row only.
export const SECRET_FIELD_KEYS: ReadonlySet<string> = new Set(['password'])

const BLOCK_ID_ALPHABET =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

const blockIdState = createState('blockId', {
  parse: (value: unknown) => (typeof value === 'string' ? value : ''),
})

const BUILTIN_TYPES = new Set([
  'root',
  'paragraph',
  'text',
  'linebreak',
  'tab',
  ...allHeadlessNodes.map((node) =>
    ('replace' in node ? (node.replace as Klass<LexicalNode>) : node).getType(),
  ),
])

const passthroughCache = new Map<string, Klass<LexicalNode>>()

// Blocks only the admin editor renders (map, stock, …); the server keeps their JSON verbatim.
const passthroughNode = (type: string): Klass<LexicalNode> => {
  const cached = passthroughCache.get(type)
  if (cached) return cached
  class PassthroughNode extends DecoratorNode<null> {
    __json: SerializedLexicalNode

    static getType(): string {
      return type
    }

    static clone(node: PassthroughNode): PassthroughNode {
      return new PassthroughNode(node.__json, node.__key)
    }

    static importJSON(json: SerializedLexicalNode): PassthroughNode {
      // The Loro binding rebuilds every node with `children: []`, which a leaf block never had.
      const {
        $: _state,
        children: _children,
        ...rest
      } = json as SerializedLexicalNode & { $?: unknown; children?: unknown }
      return new PassthroughNode(rest).updateFromJSON(json)
    }

    constructor(
      json: SerializedLexicalNode = { type, version: 1 },
      key?: NodeKey,
    ) {
      super(key)
      this.__json = json
    }

    exportJSON(): SerializedLexicalNode {
      const { type: _type, version: _version, ...state } = super.exportJSON()
      return { ...this.__json, ...state }
    }

    createDOM(): never {
      throw new Error(`${type} has no DOM on the server`)
    }

    updateDOM(): boolean {
      return false
    }

    isInline(): boolean {
      return false
    }

    decorate(): null {
      return null
    }
  }
  passthroughCache.set(type, PassthroughNode)
  return PassthroughNode
}

const collectJsonTypes = (node: unknown, out: Set<string>) => {
  if (!node || typeof node !== 'object') return
  const { children, type } = node as { children?: unknown; type?: unknown }
  if (typeof type === 'string') out.add(type)
  if (Array.isArray(children)) {
    for (const child of children) collectJsonTypes(child, out)
  }
}

const collectDocTypes = (doc: LoroDoc, out: Set<string>) => {
  for (const node of doc.getTree(TREE_NAME).nodes()) {
    const type = node.data.get('type')
    if (typeof type === 'string') out.add(type)
  }
}

const createEditor = (types: Set<string>): LexicalEditor =>
  createHeadlessEditor({
    nodes: [
      ...allHeadlessNodes,
      ...[...types]
        .filter((type) => !BUILTIN_TYPES.has(type))
        .map(passthroughNode),
    ],
    onError: (error) => {
      throw error
    },
  })

const parseState = (content: string): SerializedEditorState =>
  JSON.parse(content) as SerializedEditorState

const mintBlockId = (used: Set<string>) => {
  for (;;) {
    const id = Array.from(
      crypto.getRandomValues(new Uint8Array(8)),
      (byte) => BLOCK_ID_ALPHABET[byte & 63],
    ).join('')
    if (!used.has(id)) return id
  }
}

const $blockIdsByKey = () =>
  new Map(
    $getRoot()
      .getChildren()
      .map((child) => [child.getKey(), $getState(child, blockIdState)]),
  )

// The editor's BlockIdPlugin mints an id for every root child that lacks one, and on a
// Loro-bound editor that is an edit. Content leaves the server with ids so a load changes nothing.
const $ensureBlockIds = (previous = new Map<NodeKey, string>()) => {
  const used = new Set<string>()
  for (const child of $getRoot().getChildren()) {
    let id = $getState(child, blockIdState)
    if (!id || used.has(id)) {
      const kept = previous.get(child.getKey())
      id = kept && !used.has(kept) ? kept : mintBlockId(used)
      $setState(child, blockIdState, id)
    }
    used.add(id)
  }
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const syncList = (list: LoroList, target: string[]) => {
  const current = list.toArray() as unknown[]
  for (let i = current.length - 1; i >= 0; i--) {
    if (!target.includes(current[i] as string)) list.delete(i, 1)
  }
  const kept = list.toArray() as unknown[]
  target.forEach((item, i) => {
    if (kept[i] === item) return
    const at = kept.indexOf(item)
    if (at !== -1) {
      list.delete(at, 1)
      kept.splice(at, 1)
    }
    list.insert(i, item)
    kept.splice(i, 0, item)
  })
}

const setField = (section: LoroMap, key: string, value: unknown) => {
  if (SECRET_FIELD_KEYS.has(key)) return
  const existing = section.get(key)
  if (value === null || value === undefined) {
    if (existing !== undefined) section.delete(key)
    return
  }
  if (isStringList(value)) {
    const list =
      existing instanceof LoroList
        ? existing
        : section.setContainer(key, new LoroList())
    syncList(list, value)
    return
  }
  const current = existing instanceof LoroList ? existing.toJSON() : existing
  if (JSON.stringify(current) !== JSON.stringify(value)) {
    section.set(key, value as never)
  }
}

const sectionMap = (doc: LoroDoc, name: FieldsSection, create: boolean) => {
  const root = doc.getMap(FIELDS)
  const existing = root.get(name)
  if (existing instanceof LoroMap) return existing
  return create ? root.setContainer(name, new LoroMap()) : undefined
}

const writeFields = (doc: LoroDoc, patch: DocFieldsPatch, replace: boolean) => {
  for (const name of SECTIONS) {
    if (!(name in patch)) continue
    const values = patch[name]
    if (values === null || values === undefined) {
      if (doc.getMap(FIELDS).get(name) !== undefined) {
        doc.getMap(FIELDS).delete(name)
      }
      continue
    }
    const section = sectionMap(doc, name, true)!
    const keys = replace
      ? new Set([...section.keys(), ...Object.keys(values)])
      : Object.keys(values)
    for (const key of keys) setField(section, key, values[key] ?? null)
  }
}

export const readDocFields = (doc: LoroDoc): DocFields | undefined => {
  const root = doc.getMap(FIELDS)
  if (root.size === 0) return undefined
  const read = (name: FieldsSection) => {
    const section = sectionMap(doc, name, false)
    return section ? (section.toJSON() as Record<string, unknown>) : null
  }
  return { meta: read('meta'), typeSpecificData: read('typeSpecificData') }
}

export const createDocument = (): LoroDoc => {
  const doc = new LoroDoc()
  doc.setRecordTimestamp(true)
  return doc
}

export function createContentDoc(
  content: DocContent,
  message: string,
): LoroDoc {
  const doc = createDocument()
  const state = parseState(content.content)
  const types = new Set<string>()
  collectJsonTypes(state.root, types)
  const editor = createEditor(types)
  editor.setEditorState(editor.parseEditorState(state))
  editor.update(() => $ensureBlockIds(), { discrete: true })
  doc.getText(TITLE).insert(0, content.title)
  if (content.fields) writeFields(doc, content.fields, true)
  createLoroBinding(editor, doc, { commitMessage: message }).dispose()
  doc.commit({ message })
  return doc
}

export function readDocContent(doc: LoroDoc): DocContent {
  const types = new Set<string>()
  collectDocTypes(doc, types)
  const editor = createEditor(types)
  if (doc.getTree(TREE_NAME).roots().length > 0) {
    createLoroBinding(editor, doc).dispose()
  }
  const fields = readDocFields(doc)
  return {
    content: JSON.stringify(editor.getEditorState().toJSON()),
    title: doc.getText(TITLE).toString(),
    ...(fields ? { fields } : {}),
  }
}

export function readDocContentAt(
  doc: LoroDoc,
  frontiers: Frontiers,
): DocContent {
  return readDocContent(doc.forkAt(frontiers))
}

export function editDocAt(
  doc: LoroDoc,
  frontiers: Frontiers,
  target: DocContent,
  message: string,
  options: { peer?: PeerId } = {},
): Uint8Array {
  const fork = doc.forkAt(frontiers)
  if (options.peer !== undefined) fork.setPeerId(options.peer)
  fork.setRecordTimestamp(true)
  const state = parseState(target.content)
  const types = new Set<string>()
  collectDocTypes(fork, types)
  collectJsonTypes(state.root, types)
  const editor = createEditor(types)
  const binding = createLoroBinding(editor, fork, { commitMessage: message })
  const from = fork.oplogVersion()
  const title = fork.getText(TITLE)
  if (title.toString() !== target.title) title.update(target.title)
  if (target.fields) writeFields(fork, target.fields, true)
  editor.update(
    () => {
      // Reconciling a block without an id clears the one it had; the node keeps its key.
      const previous = $blockIdsByKey()
      $reconcileRoot(state.root)
      $ensureBlockIds(previous)
    },
    { discrete: true },
  )
  fork.commit({ message })
  binding.dispose()
  return fork.export({ from, mode: 'update' })
}

export function editDocFields(
  doc: LoroDoc,
  frontiers: Frontiers,
  patch: DocFieldsPatch,
  message: string,
  options: { peer?: PeerId } = {},
): Uint8Array {
  const fork = doc.forkAt(frontiers)
  if (options.peer !== undefined) fork.setPeerId(options.peer)
  fork.setRecordTimestamp(true)
  const from = fork.oplogVersion()
  writeFields(fork, patch, false)
  fork.commit({ message })
  if (fork.oplogVersion().compare(from) === 0) return new Uint8Array()
  return fork.export({ from, mode: 'update' })
}

export interface CaretPoint {
  id: TreeID
  offset: number
}

const TEXT_KEY = '#text'

const lastTextIn = (node: LoroTreeNode): CaretPoint | null => {
  const children = node.children() ?? []
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const found = lastTextIn(children[index])
    if (found) return found
  }
  const text = node.data.get(TEXT_KEY)
  return text === undefined
    ? null
    : { id: node.id, offset: String(text).length }
}

export function caretAtBlock(doc: LoroDoc, blockId: string): CaretPoint | null {
  for (const node of doc.getTree(TREE_NAME).nodes()) {
    const state = node.data.get('$') as { blockId?: string } | undefined
    if (state?.blockId === blockId && !node.isDeleted()) {
      return lastTextIn(node) ?? { id: node.id, offset: 0 }
    }
  }
  return null
}

export function revertChange(
  doc: LoroDoc,
  id: OpId,
  before: OpId[],
  message: string,
): Uint8Array {
  const fork = doc.fork()
  fork.setRecordTimestamp(true)
  const from = fork.oplogVersion()
  fork.applyDiff(doc.diff([id], before, false), { fullState: true })
  fork.commit({ message })
  return fork.export({ from, mode: 'update' })
}

export function vetUpdate(
  doc: LoroDoc,
  bytes: Uint8Array,
  options: { author?: string; forbidFields?: boolean } = {},
): LoroDoc {
  const probe = doc.fork()
  if (probe.import(bytes).pending) {
    throw new Error('update depends on changes missing from the document')
  }
  if (probe.getTree(TREE_NAME).roots().length > 1) {
    throw new Error('update belongs to a different document lineage')
  }
  if (options.author !== undefined) {
    const known = doc.oplogVersion()
    for (const [peer, changes] of probe.getAllChanges()) {
      const end = known.get(peer) ?? 0
      // A peer id stays bound to one author, or a forged op could claim ids another member
      // is about to send and make the server drop theirs as duplicates.
      const sharedPeer =
        end > 0 &&
        doc.getChangeAt({ counter: end - 1, peer }).message !== options.author
      for (const change of changes) {
        if (change.counter + change.length <= end) continue
        if (sharedPeer || change.message !== options.author) {
          throw new Error(
            `update carries changes not made by ${options.author} (author mismatch)`,
          )
        }
      }
    }
  }
  if (
    options.forbidFields &&
    JSON.stringify(readDocFields(probe)) !== JSON.stringify(readDocFields(doc))
  ) {
    throw new Error(
      'update changes draft fields, which this member may not edit',
    )
  }
  readDocContent(probe)
  return probe
}
