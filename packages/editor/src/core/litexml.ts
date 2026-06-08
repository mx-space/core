import {
  createDefaultRegistry,
  deserializeFromXml,
  deserializeNodesFromXml,
  type LitexmlRegistry,
  serializeNodesToXml,
  serializeToXml,
  type XmlContent,
  type XmlSerializerOptions,
} from '@haklex/rich-litexml'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

const MX_LITEXML_NODE_TYPES = ['map', 'afilmory'] as const

type SerializedNodeRecord = Record<string, unknown> & {
  $?: {
    blockId?: unknown
  }
  type?: unknown
  version?: unknown
}

function writeMxFallbackNode(node: SerializedLexicalNode): XmlContent {
  const n = node as SerializedNodeRecord
  const { $, type, version: _version, ...data } = n
  const attrs: Record<string, string> = {
    type: typeof type === 'string' ? type : 'unknown',
  }

  const blockId = $?.blockId
  if (typeof blockId === 'string' && blockId !== '') attrs.id = blockId
  if (Object.keys(data).length > 0) attrs.data = JSON.stringify(data)

  return {
    attrs,
    selfClosing: true,
    tag: 'node',
  }
}

export function registerMxLitexmlNodes(registry: LitexmlRegistry) {
  for (const type of MX_LITEXML_NODE_TYPES) {
    registry.registerWriter(type, writeMxFallbackNode)
  }
  return registry
}

export function createMxLitexmlRegistry() {
  return registerMxLitexmlNodes(createDefaultRegistry())
}

export function serializeMxLexicalToLitexml(
  state: SerializedEditorState,
  options?: XmlSerializerOptions,
) {
  return serializeToXml(state, createMxLitexmlRegistry(), options)
}

export function serializeMxLexicalNodesToLitexml(
  nodes: SerializedLexicalNode[],
  options?: XmlSerializerOptions,
) {
  return serializeNodesToXml(nodes, createMxLitexmlRegistry(), options)
}

export function deserializeMxLitexmlToLexical(xml: string) {
  return deserializeFromXml(xml, createMxLitexmlRegistry())
}

export function deserializeMxLitexmlNodes(xml: string) {
  return deserializeNodesFromXml(xml, createMxLitexmlRegistry())
}

export function stripMxLitexmlDocWrapper(xml: string) {
  const trimmed = xml.trim()
  if (trimmed.startsWith('<doc>') && trimmed.endsWith('</doc>')) {
    return trimmed.slice('<doc>'.length, trimmed.length - '</doc>'.length)
  }
  return trimmed
}
