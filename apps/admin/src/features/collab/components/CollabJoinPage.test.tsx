import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { acceptCollabInvite } from '~/api/collab'
import { ApiRequestError, getJson } from '~/api/http'
import { I18nProvider } from '~/i18n'
import { authClient } from '~/utils/authjs/auth'

import { CollabJoinPage } from './CollabJoinPage'

vi.mock('~/api/collab', () => ({ acceptCollabInvite: vi.fn() }))
vi.mock('~/api/http', async (load) => ({
  ...(await load<typeof import('~/api/http')>()),
  getJson: vi.fn(),
}))
vi.mock('~/utils/authjs/auth', () => ({
  authClient: { getSession: vi.fn(), signIn: { social: vi.fn() } },
}))

let container: HTMLDivElement
let root: Root
let router: ReturnType<typeof createMemoryRouter>

const flush = () =>
  act(async () => {
    for (let index = 0; index < 4; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  })

const render = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  router = createMemoryRouter(
    [
      { element: createElement(CollabJoinPage), path: '/collab/join/:token' },
      { element: createElement('p', null, 'document'), path: '/collab/:id' },
      { element: createElement('p', null, 'write'), path: '/posts/edit' },
    ],
    { initialEntries: ['/collab/join/tok'] },
  )
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          I18nProvider,
          null,
          createElement(RouterProvider, { router }),
        ),
      ),
    )
  })
  await flush()
}

describe('CollabJoinPage', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.clearAllMocks()
  })

  it('offers the configured sign-in providers to a signed-out reader', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({ data: null } as never)
    vi.mocked(getJson).mockResolvedValue(['github'])
    await render()

    const button = container.querySelector('button')!
    expect(button.textContent).toContain('GitHub')
    await act(async () => button.click())

    expect(authClient.signIn.social).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'github' }),
    )
    expect(acceptCollabInvite).not.toHaveBeenCalled()
  })

  it('accepts for a signed-in reader and opens the document', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: 'r1' } },
    } as never)
    vi.mocked(acceptCollabInvite).mockResolvedValue({
      documentId: 'doc-1',
      role: 'collaborator',
    })
    await render()

    expect(acceptCollabInvite).toHaveBeenCalledWith('tok')
    expect(router.state.location.pathname).toBe('/collab/doc-1')
  })

  it('sends the owner to their own draft', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: 'owner' } },
    } as never)
    vi.mocked(acceptCollabInvite).mockResolvedValue({
      documentId: 'doc-1',
      draftId: 'd1',
      refId: 'p1',
      refType: 'post',
      role: 'owner',
    })
    await render()

    expect(router.state.location.pathname).toBe('/posts/edit')
    expect(router.state.location.search).toBe('?draftId=d1&id=p1')
  })

  it('explains a link that can no longer be used', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { id: 'r1' } },
    } as never)
    vi.mocked(acceptCollabInvite).mockRejectedValue(
      new ApiRequestError('gone', 'COLLAB_INVITE_INVALID', 410),
    )
    await render()

    expect(container.textContent).toMatch(/expired|过期/)
    expect(router.state.location.pathname).toBe('/collab/join/tok')
  })
})
