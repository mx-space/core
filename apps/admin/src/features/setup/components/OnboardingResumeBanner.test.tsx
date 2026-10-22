import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getOwner } from '~/api/options'
import { I18nProvider } from '~/i18n'

import {
  readOnboardingProgress,
  writeOnboardingProgress,
} from '../utils/onboarding'
import { OnboardingResumeBanner } from './OnboardingResumeBanner'

vi.mock('~/api/options', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/options')>()),
  getOwner: vi.fn(),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  vi.mocked(getOwner).mockResolvedValue({
    id: 'owner-1',
    name: 'innei',
    username: 'innei',
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
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <OnboardingResumeBanner />
          </I18nProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )
  })
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

describe('OnboardingResumeBanner', () => {
  it('renders nothing when onboarding was never started', async () => {
    await render()
    expect(container.innerHTML).toBe('')
  })

  it('links back to setup while onboarding is still active', async () => {
    writeOnboardingProgress('owner-1', { status: 'active', step: 'ai-models' })
    await render()
    expect(container.querySelector('a[href="/setup"]')).not.toBeNull()
  })

  it('hides itself and remembers the dismissal', async () => {
    writeOnboardingProgress('owner-1', { status: 'active', step: 'site' })
    await render()
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="onboarding-dismiss"]')!
        .click()
    })
    expect(container.innerHTML).toBe('')
    expect(readOnboardingProgress('owner-1')).toEqual({
      status: 'dismissed',
      step: 'site',
    })
  })
})
