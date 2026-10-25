import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCollabInvite,
  listCollabInvites,
  listCollaborators,
  removeCollaborator,
  updateCollaborator,
} from '~/api/collab'
import { I18nProvider } from '~/i18n'

import { CollaboratorsSection } from './CollaboratorsSection'

vi.mock('~/api/collab', () => ({
  collabInviteUrlOf: (token: string) =>
    `https://admin.test/#/collab/join/${token}`,
  createCollabInvite: vi.fn(),
  listCollabInvites: vi.fn(),
  listCollaborators: vi.fn(),
  removeCollaborator: vi.fn(),
  revokeCollabInvite: vi.fn(),
  updateCollaborator: vi.fn(),
}))

let container: HTMLDivElement
let root: Root

const render = async () => {
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
          createElement(CollaboratorsSection, { documentId: 'doc-1' }),
        ),
      ),
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const click = async (element: Element | null) => {
  await act(async () => {
    ;(element as HTMLElement).click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('CollaboratorsSection', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.mocked(listCollabInvites).mockResolvedValue([])
    vi.mocked(listCollaborators).mockResolvedValue([
      {
        avatar: null,
        contributedAt: null,
        createdAt: '2026-10-25T00:00:00.000Z',
        name: 'Bob',
        readerId: 'r1',
        showInByline: true,
      },
    ])
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.clearAllMocks()
  })

  it('copies a fresh invite link to the clipboard', async () => {
    vi.mocked(createCollabInvite).mockResolvedValue({
      createdAt: '2026-10-25T00:00:00.000Z',
      expiresAt: '2026-11-01T00:00:00.000Z',
      id: 'inv-1',
      maxUses: null,
      token: 'tok',
      uses: 0,
    })
    await render()

    const invite = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.match(/invite|邀请/i),
    )
    await click(invite ?? null)

    expect(createCollabInvite).toHaveBeenCalledWith('doc-1')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://admin.test/#/collab/join/tok',
    )
  })

  it('turns a co-author off in the byline and removes them', async () => {
    vi.mocked(updateCollaborator).mockResolvedValue(undefined)
    vi.mocked(removeCollaborator).mockResolvedValue(undefined)
    await render()

    const row = container.querySelector('[data-collaborator="r1"]')!
    expect(row.textContent).toContain('Bob')
    await click(row.querySelector('input[type="checkbox"]'))
    await click(row.querySelector('button'))

    expect(updateCollaborator).toHaveBeenCalledWith('doc-1', 'r1', {
      showInByline: false,
    })
    expect(removeCollaborator).toHaveBeenCalledWith('doc-1', 'r1')
  })
})
