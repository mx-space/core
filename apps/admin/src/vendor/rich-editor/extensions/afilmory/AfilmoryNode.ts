import type { CommandItemConfig } from '@haklex/rich-editor/commands'
import { createRendererDecoration } from '@haklex/rich-editor/static'
import type {
  EditorConfig,
  LexicalCommand,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical'
import {
  $getSelection,
  $insertNodes,
  createCommand,
  DecoratorNode,
} from 'lexical'
import { Images } from 'lucide-react'
import { createElement, type ReactElement } from 'react'

import {
  AFILMORY_NODE_KEY,
  type AfilmoryLayout,
  type AfilmorySlotProps,
  type AfilmorySource,
} from './afilmory-augment'
import { type AfilmoryPayload, openAfilmoryDialog } from './afilmory-bridge'
import { AfilmoryBlockConnected } from './AfilmoryBlockConnected'

export type { AfilmoryPayload }

export const INSERT_AFILMORY_COMMAND: LexicalCommand<AfilmoryPayload> =
  createCommand('INSERT_AFILMORY_COMMAND')

export type SerializedAfilmoryNode = Spread<
  {
    baseUrl: string
    source: AfilmorySource
    layout?: AfilmoryLayout
    title?: string
    caption?: string
    alt?: string
    accent?: string
    limit?: number
  },
  SerializedLexicalNode
>

export class AfilmoryNode extends DecoratorNode<ReactElement> {
  __baseUrl: string
  __source: AfilmorySource
  __layout: AfilmoryLayout | undefined
  __title: string | undefined
  __caption: string | undefined
  __alt: string | undefined
  __accent: string | undefined
  __limit: number | undefined

  static getType(): string {
    return 'afilmory'
  }

  static clone(node: AfilmoryNode): AfilmoryNode {
    return new AfilmoryNode(
      {
        baseUrl: node.__baseUrl,
        source: node.__source,
        layout: node.__layout,
        title: node.__title,
        caption: node.__caption,
        alt: node.__alt,
        accent: node.__accent,
        limit: node.__limit,
      },
      node.__key,
    )
  }

  constructor(payload: AfilmoryPayload, key?: NodeKey) {
    super(key)
    this.__baseUrl = payload.baseUrl
    this.__source = payload.source
    this.__layout = payload.layout
    this.__title = payload.title
    this.__caption = payload.caption
    this.__alt = payload.alt
    this.__accent = payload.accent
    this.__limit = payload.limit
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'rich-afilmory-wrapper'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  isInline(): boolean {
    return false
  }

  static importJSON(serialized: SerializedAfilmoryNode): AfilmoryNode {
    return new AfilmoryNode({
      baseUrl: serialized.baseUrl,
      source: serialized.source,
      layout: serialized.layout,
      title: serialized.title,
      caption: serialized.caption,
      alt: serialized.alt,
      accent: serialized.accent,
      limit: serialized.limit,
    })
  }

  exportJSON(): SerializedAfilmoryNode {
    return {
      ...super.exportJSON(),
      baseUrl: this.__baseUrl,
      source: this.__source,
      layout: this.__layout,
      title: this.__title,
      caption: this.__caption,
      alt: this.__alt,
      accent: this.__accent,
      limit: this.__limit,
      type: 'afilmory',
      version: 1,
    }
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    const slotProps: AfilmorySlotProps = {
      nodeKey: this.__key,
      baseUrl: this.__baseUrl,
      source: this.__source,
      layout: this.__layout,
      title: this.__title,
      caption: this.__caption,
      alt: this.__alt,
      accent: this.__accent,
      limit: this.__limit,
    }
    return createRendererDecoration(
      AFILMORY_NODE_KEY,
      AfilmoryBlockConnected,
      slotProps,
    )
  }

  setPayload(payload: AfilmoryPayload): void {
    const self = this.getWritable()
    self.__baseUrl = payload.baseUrl
    self.__source = payload.source
    self.__layout = payload.layout
    self.__title = payload.title
    self.__caption = payload.caption
    self.__alt = payload.alt
    self.__accent = payload.accent
    self.__limit = payload.limit
  }

  getPayload(): AfilmoryPayload {
    return {
      baseUrl: this.__baseUrl,
      source: this.__source,
      layout: this.__layout,
      title: this.__title,
      caption: this.__caption,
      alt: this.__alt,
      accent: this.__accent,
      limit: this.__limit,
    }
  }

  static commandItems: CommandItemConfig[] = [
    {
      title: 'Afilmory',
      icon: createElement(Images, { size: 20 }),
      description: 'Insert a photo or gallery from afilmory',
      keywords: ['afilmory', 'photo', 'gallery', 'album', 'picture', 'image'],
      section: 'MEDIA',
      placement: ['slash', 'toolbar'],
      group: 'insert',
      onSelect: (editor: LexicalEditor) => {
        openAfilmoryDialog(editor, {
          onSubmit: (payload) => {
            editor.update(() => {
              const node = $createAfilmoryNode(payload)
              const selection = $getSelection()
              if (selection) $insertNodes([node])
            })
          },
        })
      },
    },
  ]
}

export function $createAfilmoryNode(payload: AfilmoryPayload): AfilmoryNode {
  return new AfilmoryNode(payload)
}

export function $isAfilmoryNode(
  node: LexicalNode | null | undefined,
): node is AfilmoryNode {
  return node instanceof AfilmoryNode
}
