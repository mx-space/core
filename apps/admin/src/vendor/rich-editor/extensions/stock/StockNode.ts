import type { CommandItemConfig } from '@haklex/rich-editor/commands'
import { createRendererDecoration } from '@haklex/rich-editor/static'
import type {
  StockKLineRange,
  StockNodePayload,
  StockVariant,
} from '@mx-space/editor'
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
import { LineChart } from 'lucide-react'
import { createElement, type ReactElement } from 'react'

import { STOCK_NODE_KEY, type StockSlotProps } from './stock-augment'
import { openStockDialog } from './stock-plugin-bridge'
import { StockBlockConnected } from './StockBlockConnected'

export type { StockNodePayload }

export const INSERT_STOCK_COMMAND: LexicalCommand<StockNodePayload> =
  createCommand('INSERT_STOCK_COMMAND')

export type SerializedStockNode = Spread<
  {
    variant: StockVariant
    symbol: string
    range?: StockKLineRange
    ema?: [number, number] | false
  },
  SerializedLexicalNode
>

export class StockNode extends DecoratorNode<ReactElement> {
  __variant: StockVariant
  __symbol: string
  __range: StockKLineRange | undefined
  __ema: [number, number] | false | undefined

  static getType(): string {
    return 'stock'
  }

  static clone(node: StockNode): StockNode {
    return new StockNode(node.getPayload(), node.__key)
  }

  constructor(payload: StockNodePayload, key?: NodeKey) {
    super(key)
    this.__variant = payload.variant
    this.__symbol = payload.symbol
    if (payload.variant === 'kline') {
      this.__range = payload.range
      this.__ema = payload.ema
    } else {
      this.__range = undefined
      this.__ema = undefined
    }
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'rich-stock-wrapper'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  isInline(): boolean {
    return false
  }

  static importJSON(serialized: SerializedStockNode): StockNode {
    if (serialized.variant === 'kline') {
      return new StockNode({
        variant: 'kline',
        symbol: serialized.symbol,
        range: serialized.range as StockKLineRange,
        ema: serialized.ema,
      })
    }
    return new StockNode({
      variant: 'snapshot',
      symbol: serialized.symbol,
    })
  }

  exportJSON(): SerializedStockNode {
    const base = {
      ...super.exportJSON(),
      type: 'stock',
      version: 1,
      variant: this.__variant,
      symbol: this.__symbol,
    } as SerializedStockNode
    if (this.__variant === 'kline') {
      base.range = this.__range
      base.ema = this.__ema
    }
    return base
  }

  getPayload(): StockNodePayload {
    if (this.__variant === 'kline' && this.__range) {
      return {
        variant: 'kline',
        symbol: this.__symbol,
        range: this.__range,
        ema: this.__ema,
      }
    }
    return { variant: 'snapshot', symbol: this.__symbol }
  }

  setPayload(payload: StockNodePayload): void {
    const writable = this.getWritable()
    writable.__variant = payload.variant
    writable.__symbol = payload.symbol
    if (payload.variant === 'kline') {
      writable.__range = payload.range
      writable.__ema = payload.ema
    } else {
      writable.__range = undefined
      writable.__ema = undefined
    }
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    const slotProps: StockSlotProps = {
      nodeKey: this.__key,
      variant: this.__variant,
      symbol: this.__symbol,
      range: this.__range,
      ema: this.__ema,
    }
    return createRendererDecoration(
      STOCK_NODE_KEY,
      StockBlockConnected,
      slotProps,
    )
  }

  static commandItems: CommandItemConfig[] = [
    {
      title: 'Stock',
      icon: createElement(LineChart, { size: 20 }),
      description: 'Live quote or historical K-line',
      keywords: [
        'stock',
        'ticker',
        'snapshot',
        'quote',
        'kline',
        'candle',
        'price',
      ],
      section: 'MEDIA',
      placement: ['slash', 'toolbar'],
      group: 'insert',
      onSelect: (editor: LexicalEditor) => {
        openStockDialog(editor, {
          onSubmit: (payload) => {
            editor.update(() => {
              const node = $createStockNode(payload)
              const selection = $getSelection()
              if (selection) $insertNodes([node])
            })
          },
        })
      },
    },
  ]
}

export function $createStockNode(payload: StockNodePayload): StockNode {
  return new StockNode(payload)
}

export function $isStockNode(
  node: LexicalNode | null | undefined,
): node is StockNode {
  return node instanceof StockNode
}
