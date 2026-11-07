import { describe, expect, it, vi } from 'vitest'

import { remeasureScene } from './excalidraw-remeasure'

const scene = (text: string) =>
  JSON.stringify({
    elements: [
      { id: 't1', type: 'text', text, originalText: text, width: 40 },
      { id: 'r1', type: 'rectangle', width: 100 },
    ],
    appState: { viewBackgroundColor: '#fff' },
  })

describe('remeasureScene', () => {
  it('refreshes text dimensions when a text changed', async () => {
    const restore = vi.fn((elements: any[]) =>
      elements.map((element) =>
        element.type === 'text' ? { ...element, width: 120 } : element,
      ),
    )

    const next = await remeasureScene(
      scene('Architecture'),
      scene('架构'),
      restore,
    )

    expect(restore).toHaveBeenCalledWith(expect.any(Array), null, {
      refreshDimensions: true,
    })
    const parsed = JSON.parse(next)
    expect(parsed.elements[0].width).toBe(120)
    expect(parsed.appState).toEqual({ viewBackgroundColor: '#fff' })
  })

  it('leaves the scene untouched when no text changed', async () => {
    const restore = vi.fn()
    const unchanged = scene('架构').replace('"width":100', '"width":200')

    const next = await remeasureScene(unchanged, scene('架构'), restore)

    expect(next).toBe(unchanged)
    expect(restore).not.toHaveBeenCalled()
  })

  it('measures new text elements in a new drawing', async () => {
    const restore = vi.fn((elements: any[]) => elements)

    await remeasureScene(scene('New'), null, restore)

    expect(restore).toHaveBeenCalled()
  })
})
