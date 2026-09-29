import { allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import {
  DecoratorNode,
  type LexicalEditor,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical'

class AgentDiffHeadlessNode extends DecoratorNode<null> {
  __json: SerializedLexicalNode

  static getType(): string {
    return 'agent-diff'
  }

  static clone(node: AgentDiffHeadlessNode): AgentDiffHeadlessNode {
    return new AgentDiffHeadlessNode(node.__json, node.__key)
  }

  static importJSON(json: SerializedLexicalNode): AgentDiffHeadlessNode {
    return new AgentDiffHeadlessNode(json)
  }

  constructor(
    json: SerializedLexicalNode = { type: 'agent-diff', version: 2 },
    key?: NodeKey,
  ) {
    super(key)
    this.__json = json
  }

  exportJSON(): SerializedLexicalNode {
    return this.__json
  }

  createDOM(): never {
    throw new Error('agent-diff has no DOM in the headless author editor')
  }

  updateDOM(): boolean {
    return false
  }

  decorate(): null {
    return null
  }
}

export const createAuthorHeadlessEditor = (): LexicalEditor =>
  createHeadlessEditor({
    nodes: [...allHeadlessNodes, AgentDiffHeadlessNode],
    onError: (err) => {
      throw err
    },
  })
