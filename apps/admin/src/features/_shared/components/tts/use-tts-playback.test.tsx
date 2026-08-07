import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTtsPlayback } from './use-tts-playback'

type Listener = () => void

class MockAudio {
  static instances: MockAudio[] = []

  currentTime = 0
  paused = true
  preload = ''
  src = ''

  private listeners = new Map<string, Set<Listener>>()

  addEventListener = (type: string, listener: Listener) => {
    const set = this.listeners.get(type) ?? new Set<Listener>()
    set.add(listener)
    this.listeners.set(type, set)
  }

  load = vi.fn()

  pause = vi.fn(() => {
    this.paused = true
    this.emit('pause')
  })

  play = vi.fn(() => {
    this.paused = false
    this.emit('play')
    return Promise.resolve()
  })

  removeAttribute = vi.fn()

  constructor() {
    MockAudio.instances.push(this)
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener())
  }
}

const URLS = [
  'https://example.com/segment-1.mp3',
  'https://example.com/segment-2.mp3',
  'https://example.com/segment-3.mp3',
]

interface Harness {
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let mounted = true
  return {
    root,
    unmount: () => {
      if (!mounted) return
      mounted = false
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

let latest: ReturnType<typeof useTtsPlayback> | undefined

function Probe(props: { urls: string[] }) {
  latest = useTtsPlayback(props.urls)
  return null
}

let harness: Harness

beforeEach(() => {
  MockAudio.instances = []
  vi.stubGlobal('Audio', MockAudio)
  latest = undefined
  harness = mount()
  act(() => {
    harness.root.render(createElement(Probe, { urls: URLS }))
  })
})

afterEach(() => {
  harness.unmount()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function audio() {
  return MockAudio.instances[0]
}

describe('useTtsPlayback', () => {
  it('starts from the first segment on playAll', () => {
    act(() => {
      latest!.playAll()
    })

    expect(audio().src).toBe(URLS[0])
    expect(audio().play).toHaveBeenCalledTimes(1)
    expect(latest!.playingIndex).toBe(0)
    expect(latest!.isPlaying).toBe(true)
  })

  it('advances to the next segment when the current one ends', () => {
    act(() => {
      latest!.playAll()
    })
    act(() => {
      audio().emit('ended')
    })

    expect(audio().src).toBe(URLS[1])
    expect(audio().play).toHaveBeenCalledTimes(2)
    expect(latest!.playingIndex).toBe(1)
    expect(latest!.isPlaying).toBe(true)
  })

  it('resets after the last segment ends', () => {
    act(() => {
      latest!.playAll()
    })
    act(() => {
      audio().emit('ended')
    })
    act(() => {
      audio().emit('ended')
    })
    expect(latest!.playingIndex).toBe(2)

    act(() => {
      audio().emit('ended')
    })
    expect(latest!.playingIndex).toBe(null)
    expect(latest!.isPlaying).toBe(false)
  })

  it('pauses and resumes the current segment on toggle', () => {
    act(() => {
      latest!.toggleSegment(1)
    })
    expect(audio().src).toBe(URLS[1])

    act(() => {
      latest!.toggleSegment(1)
    })
    expect(audio().pause).toHaveBeenCalledTimes(1)
    expect(latest!.playingIndex).toBe(1)
    expect(latest!.isPlaying).toBe(false)

    act(() => {
      latest!.toggleSegment(1)
    })
    expect(audio().play).toHaveBeenCalledTimes(2)
    expect(latest!.isPlaying).toBe(true)
  })

  it('switches the segment when toggling a different index', () => {
    act(() => {
      latest!.toggleSegment(0)
    })
    act(() => {
      latest!.toggleSegment(2)
    })

    expect(audio().src).toBe(URLS[2])
    expect(latest!.playingIndex).toBe(2)
    expect(latest!.isPlaying).toBe(true)
  })

  it('clears progress on stop', () => {
    act(() => {
      latest!.toggleSegment(1)
    })
    act(() => {
      latest!.stop()
    })

    expect(audio().pause).toHaveBeenCalled()
    expect(latest!.playingIndex).toBe(null)
    expect(latest!.isPlaying).toBe(false)
  })

  it('stops playback when the urls change underneath it', () => {
    act(() => {
      latest!.playAll()
    })
    act(() => {
      harness.root.render(
        createElement(Probe, {
          urls: ['https://example.com/other-1.mp3'],
        }),
      )
    })

    expect(audio().pause).toHaveBeenCalled()
    expect(latest!.playingIndex).toBe(null)
    expect(latest!.isPlaying).toBe(false)
  })

  it('releases the audio element on unmount', () => {
    act(() => {
      latest!.playAll()
    })
    const element = audio()

    harness.unmount()

    expect(element.pause).toHaveBeenCalled()
    expect(element.removeAttribute).toHaveBeenCalledWith('src')
  })
})
