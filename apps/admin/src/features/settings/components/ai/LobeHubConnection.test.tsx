import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import * as api from '~/api/ai'
import { UI_LOCALE_STORAGE_KEY } from '~/constants/keys'
import { I18nProvider } from '~/i18n'

import { LobeHubConnection } from './LobeHubConnection'

// Keep the real dialog; happy-dom rejects cancelled native animations.
vi.mock('motion/react', async () => {
  const { createElement, forwardRef } = await import('react')
  return {
    AnimatePresence: ({ children }: any) => children,
    motion: {
      div: forwardRef(
        ({ animate, exit, initial, transition, ...props }: any, ref) =>
          createElement('div', { ...props, ref }),
      ),
    },
  }
})

vi.mock('~/api/ai', () => ({
  getLobeHubAccount: vi.fn(),
  startLobeHubLogin: vi.fn(),
  pollLobeHubLogin: vi.fn(),
  cancelLobeHubLogin: vi.fn(async () => {}),
  disconnectLobeHub: vi.fn(),
}))
let root: Root, query: QueryClient
const login = {
  flowId: 'flow-1',
  userCode: 'ABCD-EFGH',
  verificationUri: 'https://app.lobehub.com/oidc/device',
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  intervalSeconds: 5,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  localStorage.setItem(UI_LOCALE_STORAGE_KEY, 'zh-CN')
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.mocked(api.getLobeHubAccount).mockResolvedValue({
    status: 'disconnected',
    name: null,
    email: null,
  })
  vi.mocked(api.startLobeHubLogin).mockResolvedValue(login)
  vi.mocked(api.pollLobeHubLogin).mockResolvedValue({
    status: 'pending',
    intervalSeconds: 5,
  })
})
afterEach(async () => {
  await act(async () => {
    root.unmount()
    await vi.advanceTimersByTimeAsync(300)
  })
  query.clear()
  document.body.innerHTML = ''
  vi.useRealTimers()
})
async function mount(onConnected = vi.fn()) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={query}>
        <I18nProvider>
          <LobeHubConnection
            onConnected={onConnected}
            onDisconnected={() => {}}
          />
        </I18nProvider>
      </QueryClientProvider>,
    )
    await vi.advanceTimersByTimeAsync(1)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
}
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(text),
  )
  expect(button, text).toBeDefined()
  await act(async () => {
    button!.click()
    await vi.advanceTimersByTimeAsync(1)
  })
}

it('opens a separate authorization dialog and refreshes models after connection', async () => {
  const connected = vi.fn()
  await mount(connected)
  await click('登录 LobeHub')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    'ABCD-EFGH',
  )
  const link = document.querySelector<HTMLAnchorElement>('a[target="_blank"]')
  expect(link?.href).toBe(login.verificationUri)
  vi.mocked(api.getLobeHubAccount).mockResolvedValue({
    status: 'connected',
    name: 'Example',
    email: 'example@example.com',
  })
  vi.mocked(api.pollLobeHubLogin).mockResolvedValue({ status: 'connected' })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5200)
  })
  expect(connected).toHaveBeenCalledOnce()
  expect(document.body.textContent).toContain('example@example.com')
  expect(document.body.textContent).not.toContain('正在等待授权')
})

it('cancels a late device response when the dialog closes during startup', async () => {
  let resolve!: (value: typeof login) => void
  vi.mocked(api.startLobeHubLogin).mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  await mount()
  await click('登录 LobeHub')
  await click('取消')
  await act(async () => {
    resolve(login)
    await vi.advanceTimersByTimeAsync(10_000)
  })
  expect(api.pollLobeHubLogin).not.toHaveBeenCalled()
  expect(api.cancelLobeHubLogin).toHaveBeenCalledWith('flow-1')
})

it.each(['expired', 'denied'] as const)(
  'shows a recovery action when authorization is %s',
  async (status) => {
    await mount()
    await click('登录 LobeHub')
    vi.mocked(api.pollLobeHubLogin).mockResolvedValue({ status })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(document.body.textContent).toContain(
      status === 'expired' ? '验证码已过期' : '授权已取消',
    )
    expect(document.body.textContent).toContain('重新获取验证码')
  },
)
