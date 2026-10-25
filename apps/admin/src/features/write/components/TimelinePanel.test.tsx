import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listCollaborators } from '~/api/collab'
import {
  getDraftHistory,
  getDraftShare,
  restoreDraftRevision,
  undoDraftChange,
} from '~/api/drafts'
import { I18nProvider } from '~/i18n'
import type { DraftHistory } from '~/models/draft'

import { TimelinePanel } from './TimelinePanel'

vi.mock('~/api/drafts', () => ({
  deleteDraftShare: vi.fn(),
  getDraftHistory: vi.fn(),
  getDraftShare: vi.fn(),
  restoreDraftRevision: vi.fn(),
  setDraftShare: vi.fn(),
  undoDraftChange: vi.fn(),
}))
vi.mock('~/api/collab', () => ({
  collabInviteUrlOf: (token: string) => token,
  createCollabInvite: vi.fn(),
  listCollabInvites: vi.fn(async () => []),
  listCollaborators: vi.fn(async () => []),
  removeCollaborator: vi.fn(),
  revokeCollabInvite: vi.fn(),
  updateCollaborator: vi.fn(),
}))
vi.mock('~/ui/feedback/confirm', () => ({
  confirmDialog: vi.fn(async () => true),
}))

const history: DraftHistory = {
  changes: [
    {
      deps: [{ counter: 3, peer: '1' }],
      id: { counter: 4, peer: '1' },
      length: 1,
      message: 'human:owner',
      timestamp: 1_792_900_000,
    },
  ],
  checkpoints: [
    {
      createdAt: '2026-10-25T00:00:00.000Z',
      frontiers: [],
      id: 'rev-1',
      kind: 'save',
      parentRevisionId: null,
      title: 'Saved',
    },
  ],
} as unknown as DraftHistory

let container: HTMLDivElement
let root: Root
const calls: string[] = []
const onBeforeChange = vi.fn(async () => {
  calls.push('flush')
})
const onChanged = vi.fn(async (change: { restored: boolean }) => {
  calls.push(change.restored ? 'reload-fields' : 'pull')
})

const render = async (documentId: string | null = null) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          I18nProvider,
          null,
          createElement(TimelinePanel, {
            documentId,
            draftId: 'd1',
            onBeforeChange,
            onChanged,
            onClose: () => undefined,
            publishedRevisionId: null,
          }),
        ),
      ),
    )
  })
  await act(async () => {
    await Promise.resolve()
  })
}

const click = async (label: string) => {
  const button = await vi.waitFor(() => {
    const found = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    )
    expect(found).not.toBeNull()
    return found!
  })
  await act(async () => {
    button.click()
  })
  await vi.waitFor(() => expect(onChanged).toHaveBeenCalled())
}

beforeEach(() => {
  calls.length = 0
  onChanged.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  vi.mocked(getDraftHistory).mockResolvedValue(history)
  vi.mocked(getDraftShare).mockResolvedValue(null as never)
  vi.mocked(restoreDraftRevision).mockImplementation(async () => {
    calls.push('restore')
    return {} as never
  })
  vi.mocked(undoDraftChange).mockImplementation(async () => {
    calls.push('undo')
    return {} as never
  })
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('TimelinePanel', () => {
  it('sends unsent edits before restoring and reloads fields after', async () => {
    await render()

    await click('恢复到此版本')

    expect(calls).toEqual(['flush', 'restore', 'reload-fields'])
  })

  it('sends unsent edits before undoing a step', async () => {
    await render()

    await click('撤销此步')

    expect(calls).toEqual(['flush', 'undo', 'pull'])
  })

  it('names co-author steps, including people since removed', async () => {
    vi.mocked(getDraftHistory).mockResolvedValue({
      changes: [
        {
          deps: [],
          id: { counter: 9, peer: '3' },
          length: 1,
          message: 'human:r2',
          timestamp: 1_792_900_200,
        },
        {
          deps: [],
          id: { counter: 5, peer: '2' },
          length: 1,
          message: 'human:r1',
          timestamp: 1_792_900_100,
        },
      ],
      checkpoints: [],
    } as unknown as DraftHistory)
    vi.mocked(listCollaborators).mockResolvedValue([
      {
        avatar: null,
        contributedAt: '2026-10-25T00:00:00.000Z',
        createdAt: '2026-10-25T00:00:00.000Z',
        name: 'Bob',
        readerId: 'r1',
        removedAt: '2026-10-25T01:00:00.000Z',
        showInByline: true,
      },
    ])

    await render('doc-1')

    await vi.waitFor(() =>
      expect(container.textContent).toContain('Bob 的编辑'),
    )
    expect(container.textContent).toContain('共同作者 的编辑')
    expect(container.textContent).not.toContain('r2 的编辑')
    expect(container.querySelector('[data-collaborator]')).toBeNull()
  })
})
