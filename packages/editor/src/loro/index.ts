import {
  $reconcileRoot,
  createLoroBinding,
  TREE_NAME,
} from '@haklex/rich-collab-loro'
import { allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import {
  DecoratorNode,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedEditorState,
  type SerializedLexicalNode,
} from 'lexical'
import { LoroDoc, type OpId } from 'loro-crdt'

export type Frontiers = ReturnType<LoroDoc['frontiers']>
export type PeerId = Parameters<LoroDoc['setPeerId']>[0]

export interface DocContent {
  content: string
  title: string
}

const TITLE = 'title'

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
      const { children: _children, ...rest } = json as SerializedLexicalNode & {
        children?: unknown
      }
      return new PassthroughNode(rest)
    }

    constructor(
      json: SerializedLexicalNode = { type, version: 1 },
      key?: NodeKey,
    ) {
      super(key)
      this.__json = json
    }

    exportJSON(): SerializedLexicalNode {
      return this.__json
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
  doc.getText(TITLE).insert(0, content.title)
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
  return {
    content: JSON.stringify(editor.getEditorState().toJSON()),
    title: doc.getText(TITLE).toString(),
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
  editor.update(() => $reconcileRoot(state.root), { discrete: true })
  fork.commit({ message })
  binding.dispose()
  return fork.export({ from, mode: 'update' })
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
  options: { author?: string } = {},
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
      for (const change of changes) {
        if (change.counter + change.length <= end) continue
        if (change.message !== options.author) {
          throw new Error(
            `update carries changes not made by ${options.author} (author mismatch)`,
          )
        }
      }
    }
  }
  readDocContent(probe)
  return probe
}
