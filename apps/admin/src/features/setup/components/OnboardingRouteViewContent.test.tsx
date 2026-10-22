import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkLogged } from '~/api/auth'
import { getOption, getOwner, getUrlOptions } from '~/api/options'
import { checkIsInit } from '~/features/auth/utils/check-init'
import { I18nProvider } from '~/i18n'

import { markOnboardingPending } from '../utils/onboarding'
import { OnboardingRouteViewContent } from './OnboardingRouteViewContent'

vi.mock('~/features/auth/utils/check-init', () => ({ checkIsInit: vi.fn() }))
vi.mock('~/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/auth')>()),
  checkLogged: vi.fn(),
}))
vi.mock('~/api/options', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/options')>()),
  getOption: vi.fn(),
  getOwner: vi.fn(),
  getUrlOptions: vi.fn(),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  vi.mocked(checkIsInit).mockResolvedValue(true)
  vi.mocked(checkLogged).mockResolvedValue({ ok: true })
  vi.mocked(getOwner).mockResolvedValue({
    id: 'owner-1',
    name: 'innei',
    username: 'innei',
  })
  vi.mocked(getOption).mockResolvedValue({})
  vi.mocked(getUrlOptions).mockResolvedValue({
    adminUrl: '',
    serverUrl: '',
    webUrl: '',
    wsUrl: '',
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

async function render() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/setup']}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <Routes>
              <Route element={<OnboardingRouteViewContent />} path="/setup" />
              <Route element={<p>dashboard page</p>} path="/dashboard" />
            </Routes>
          </I18nProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )
  })
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

describe('OnboardingRouteViewContent', () => {
  it('sends an initialized owner without an active run to the dashboard', async () => {
    await render()
    expect(container.textContent).toContain('dashboard page')
  })

  it('resumes a run that was started before signing in', async () => {
    markOnboardingPending()
    await render()
    expect(
      container
        .querySelector('[aria-current="step"]')
        ?.getAttribute('data-step'),
    ).toBe('site')
  })
})
