import { createEditor } from 'lexical'
import { describe, expect, it, vi } from 'vitest'

import {
  $createStockNode,
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

  it('exposes exactly two commandItems for snapshot and kline', () => {
    expect(StockNode.commandItems.length).toBe(2)
    expect(StockNode.commandItems[0]!.title).toContain('snapshot')
    expect(StockNode.commandItems[1]!.title).toContain('K-line')
  })
})
