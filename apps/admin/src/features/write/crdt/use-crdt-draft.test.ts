import { LoroDoc } from 'loro-crdt'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type CrdtDraftController, useCrdtDraft } from './use-crdt-draft'

const api = vi.hoisted(() => ({
  getDraftCrdt: vi.fn(),
  postDraftCrdt: vi.fn(),
}))
vi.mock('~/api/drafts', () => api)
vi.mock('~/socket/SocketBridge', () => ({
  subscribeAdminSocket: (listener: (socket: null) => void) => {
    listener(null)
    return () => undefined
  },
}))

let container: HTMLDivElement
let root: Root
let current: CrdtDraftController

function Probe(props: { draftId: string }) {
  current = useCrdtDraft({
    draftId: props.draftId,
    enabled: true,
    onRejected: async () => undefined,
    onRemoteTitle: () => undefined,
  })
  return null
}

const render = (draftId: string) =>
  act(async () => {
    root.render(createElement(Probe, { draftId }))
  })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  container = document.createElement('div')
  root = createRoot(container)
  api.getDraftCrdt.mockReset()
  api.postDraftCrdt.mockReset()
})

afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
})

describe('useCrdtDraft', () => {
  it('stays locked and retries when the first load fails', async () => {
    api.getDraftCrdt
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValue(new LoroDoc().export({ mode: 'snapshot' }))

    await render('d1')
    await act(async () => {
      await Promise.resolve()
    })

    expect(current.active).toBe(false)
    expect(current.locked).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(api.getDraftCrdt).toHaveBeenCalledTimes(2)
    expect(current.active).toBe(true)
    expect(current.locked).toBe(false)
  })
})

describe('useCrdtDraft adopt', () => {
  it('leaves the editor writable while a first save is being adopted', async () => {
    let resolve: (bytes: Uint8Array) => void = () => undefined
    api.getDraftCrdt.mockReturnValue(
      new Promise<Uint8Array>((done) => {
        resolve = done
      }),
    )

    await render('')
    act(() => current.adoptEditorOnBind())
    await render('d2')

    expect(current.active).toBe(false)
    expect(current.locked).toBe(false)

    await act(async () => {
      resolve(new LoroDoc().export({ mode: 'snapshot' }))
    })
    expect(current.active).toBe(true)
  })
})
