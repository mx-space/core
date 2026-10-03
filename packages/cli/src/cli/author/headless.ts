import { allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import {
  DecoratorNode,
  type LexicalEditor,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical'

// Blocks rendered only by the admin editor; the headless side keeps their JSON verbatim.
const createPassthroughNode = (type: string) =>
  class PassthroughHeadlessNode extends DecoratorNode<null> {
    __json: SerializedLexicalNode

    static getType(): string {
      return type
    }

    static clone(node: PassthroughHeadlessNode): PassthroughHeadlessNode {
      return new PassthroughHeadlessNode(node.__json, node.__key)
    }

    static importJSON(json: SerializedLexicalNode): PassthroughHeadlessNode {
      return new PassthroughHeadlessNode(json)
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
      throw new Error(`${type} has no DOM in the headless author editor`)
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

const passthroughNodes = ['agent-diff', 'map', 'stock'].map(
  createPassthroughNode,
)

export const createAuthorHeadlessEditor = (): LexicalEditor =>
  createHeadlessEditor({
    nodes: [...allHeadlessNodes, ...passthroughNodes],
    onError: (err) => {
      throw err
    },
  })
