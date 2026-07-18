import { $createParagraphNode, $getRoot, createEditor } from 'lexical'
import { describe, expect, it, vi } from 'vitest'

import {
  registerStockDialogOpener,
  unregisterStockDialogOpener,
} from '../stock-plugin-bridge'
import {
  $createStockNode,
  $isStockNode,
  type SerializedStockNode,
  StockNode,
  type StockNodePayload,
} from '../StockNode'

vi.mock('@haklex/rich-editor/static', () => ({
  createRendererDecoration: () => null,
}))
vi.mock('../StockBlockConnected', () => ({
  StockBlockConnected: () => null,
}))

function withEditor<T>(run: () => T): T {
  const editor = createEditor({ nodes: [StockNode], onError: () => {} })
  let result!: T
  editor.update(
    () => {
      result = run()
    },
    { discrete: true },
  )
  return result
}

describe('StockNode', () => {
  it('round-trips importJSON(exportJSON()) for snapshot variant', () => {
    const original: StockNodePayload = {
      variant: 'snapshot',
      symbol: 'AAPL',
    }
    const { exported, restoredPayload } = withEditor(() => {
      const node = $createStockNode(original)
      const json = node.exportJSON() as SerializedStockNode
      const restored = StockNode.importJSON(json)
      return { exported: json, restoredPayload: restored.getPayload() }
    })

    expect(exported.type).toBe('stock')
    expect(exported.variant).toBe('snapshot')
    expect(exported.symbol).toBe('AAPL')
    expect(exported.range).toBeUndefined()
    expect(exported.ema).toBeUndefined()
    expect(restoredPayload).toEqual(original)
  })

  it('round-trips importJSON(exportJSON()) for kline variant with EMA', () => {
    const original: StockNodePayload = {
      variant: 'kline',
      symbol: '9988.HK',
      range: {
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-06-30T00:00:00.000Z',
        interval: '1d',
      },
      ema: [5, 20],
    }
    const { exported, restoredPayload } = withEditor(() => {
      const node = $createStockNode(original)
      const json = node.exportJSON() as SerializedStockNode
      const restored = StockNode.importJSON(json)
      return { exported: json, restoredPayload: restored.getPayload() }
    })

    expect(exported.variant).toBe('kline')
    expect(exported.symbol).toBe('9988.HK')
    expect(exported.range).toEqual(original.range)
    expect(exported.ema).toEqual([5, 20])
    expect(restoredPayload).toEqual(original)
  })

  it('opens the stock dialog and inserts the submitted stock selection', async () => {
    const editor = createEditor({ nodes: [StockNode], onError: () => {} })
    editor.update(
      () => {
        const paragraph = $createParagraphNode()
        $getRoot().append(paragraph)
        paragraph.select()
      },
      { discrete: true },
    )

    const openDialog = vi.fn()
    registerStockDialogOpener(editor, openDialog)

    const commandItem = StockNode.commandItems.find((item) =>
      item.keywords?.includes('stock'),
    )
    expect(commandItem).toBeDefined()

    commandItem!.onSelect(editor, '')
    expect(openDialog).toHaveBeenCalledOnce()

    const payload: StockNodePayload = {
      variant: 'snapshot',
      symbol: 'MSFT',
    }
    const update = new Promise<void>((resolve) => {
      const unregister = editor.registerUpdateListener(() => {
        unregister()
        resolve()
      })
    })
    openDialog.mock.calls[0]![0].onSubmit(payload)
    await update

    const insertedPayload = editor.getEditorState().read(() => {
      const stockNode = $getRoot().getChildren().find($isStockNode)
      return stockNode?.getPayload()
    })
    expect(insertedPayload).toEqual(payload)

    unregisterStockDialogOpener(editor)
  })
})
