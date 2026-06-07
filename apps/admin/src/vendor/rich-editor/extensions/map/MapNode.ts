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
import { MapPin, Navigation } from 'lucide-react'
import { createElement, type ReactElement } from 'react'

import { openLocationDialog } from './location-plugin-bridge'
import { MAP_NODE_KEY, type MapSlotProps } from './map-augment'
import { openMapDialog } from './map-plugin-bridge'
import { MapBlockConnected } from './MapBlockConnected'
import type { MapPoi, MapView } from './types'

export interface MapNodePayload {
  pois?: MapPoi[]
  title: string
  track?: { url: string }
  view?: MapView
}

export const INSERT_MAP_COMMAND: LexicalCommand<MapNodePayload> =
  createCommand('INSERT_MAP_COMMAND')

export type SerializedMapNode = Spread<
  {
    pois?: MapPoi[]
    title: string
    track?: { url: string }
    view?: MapView
  },
  SerializedLexicalNode
>

export class MapNode extends DecoratorNode<ReactElement> {
  __title: string
  __track: { url: string } | undefined
  __pois: MapPoi[] | undefined
  __view: MapView | undefined

  static getType(): string {
    return 'map'
  }

  static clone(node: MapNode): MapNode {
    return new MapNode(
      {
        title: node.__title,
        track: node.__track,
        pois: node.__pois,
        view: node.__view,
      },
      node.__key,
    )
  }

  constructor(payload: MapNodePayload, key?: NodeKey) {
    super(key)
    this.__title = payload.title
    this.__track = payload.track
    this.__pois = payload.pois
    this.__view = payload.view
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'rich-map-wrapper'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  isInline(): boolean {
    return false
  }

  static importJSON(serialized: SerializedMapNode): MapNode {
    return new MapNode({
      pois: serialized.pois,
      title: serialized.title ?? '',
      track: serialized.track,
      view: serialized.view,
    })
  }

  exportJSON(): SerializedMapNode {
    return {
      ...super.exportJSON(),
      pois: this.__pois,
      title: this.__title,
      track: this.__track,
      type: 'map',
      version: 1,
      view: this.__view,
    }
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    const slotProps: MapSlotProps = {
      nodeKey: this.__key,
      pois: this.__pois,
      title: this.__title,
      track: this.__track,
      view: this.__view,
    }
    return createRendererDecoration(MAP_NODE_KEY, MapBlockConnected, slotProps)
  }

  setPayload(payload: MapNodePayload): void {
    const self = this.getWritable()
    self.__title = payload.title
    self.__track = payload.track
    self.__pois = payload.pois
    self.__view = payload.view
  }

  getPayload(): MapNodePayload {
    return {
      pois: this.__pois,
      title: this.__title,
      track: this.__track,
      view: this.__view,
    }
  }

  static commandItems: CommandItemConfig[] = [
    {
      title: 'Location',
      icon: createElement(MapPin, { size: 20 }),
      description: 'Pin a single place on a map',
      keywords: ['location', 'place', 'pin', 'poi', 'map'],
      section: 'MEDIA',
      placement: ['slash', 'toolbar'],
      group: 'insert',
      onSelect: (editor: LexicalEditor) => {
        openLocationDialog(editor, {
          onSubmit: (payload) => {
            editor.update(() => {
              const node = $createMapNode(payload)
              const selection = $getSelection()
              if (selection) $insertNodes([node])
            })
          },
        })
      },
    },
    {
      title: 'Map (GPX track)',
      icon: createElement(Navigation, { size: 20 }),
      description: 'Embed a GPS track from a .gpx file or track JSON URL',
      keywords: ['map', 'gps', 'gpx', 'track', 'route'],
      section: 'MEDIA',
      placement: ['slash', 'toolbar'],
      group: 'insert',
      onSelect: (editor: LexicalEditor) => {
        openMapDialog(editor, {
          onSubmit: (payload) => {
            editor.update(() => {
              const node = $createMapNode(payload)
              const selection = $getSelection()
              if (selection) $insertNodes([node])
            })
          },
        })
      },
    },
  ]
}

export function $createMapNode(payload: MapNodePayload): MapNode {
  return new MapNode(payload)
}

export function $isMapNode(
  node: LexicalNode | null | undefined,
): node is MapNode {
  return node instanceof MapNode
}
