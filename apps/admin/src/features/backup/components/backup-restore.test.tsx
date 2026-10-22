import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionGlobalConfig } from 'motion/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { WelcomeStep } from '~/features/setup/components/WelcomeStep'
import { I18nProvider } from '~/i18n'
import { ModalRoot } from '~/ui/feedback/modal-imperative'
import { FloatLayerProvider } from '~/ui/overlay/floating-layer'

import { BackupRouteViewContent } from './BackupRouteViewContent'

let root: Root
let queryClient: QueryClient
let uploads: { path: string; body: FormData }[]

beforeEach(() => {
  MotionGlobalConfig.skipAnimations = true
  vi.useFakeTimers()
  uploads = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = init.body as FormData
        uploads.push({ path: new URL(url, location.origin).pathname, body })
        const wrongKey = body.get('decryptionKey') === 'wrong-key'
        return new Response(
          JSON.stringify(
            wrongKey ? { error: { message: 'wrong key' } } : { data: null },
          ),
          { status: wrongKey ? 400 : 200 },
        )
      }
      return new Response(
        JSON.stringify({
          data: url.endsWith('/backups') ? [] : { version: '15.0.0' },
        }),
      )
    }),
  )
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  queryClient.clear()
  document.body.innerHTML = ''
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  MotionGlobalConfig.skipAnimations = false
})

async function mount(setup: boolean) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FloatLayerProvider>
            <I18nProvider>
              {setup ? (
                <WelcomeStep connected onFresh={() => {}} />
              ) : (
                <BackupRouteViewContent />
              )}
              <ModalRoot />
            </I18nProvider>
          </FloatLayerProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  )
}

async function selectFile(contents: string, filename: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([contents], filename)
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () =>
    input.dispatchEvent(new Event('change', { bubbles: true })),
  )
}

async function submitKey(key: string) {
  await act(async () => {
    const input = document.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!.call(input, key)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () =>
    document
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}

it.each([true, false])(
  'prompts for encrypted files and retries a failed key in setup=%s',
  async (setup) => {
    await mount(setup)
    await selectFile('MXBACKUP encrypted archive', 'renamed.zip')
    expect(document.querySelector('textarea')).not.toBeNull()
    expect(uploads).toHaveLength(0)
    await submitKey('wrong-key')
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      'wrong key',
    )
    await submitKey(' saved-private-key ')
    expect(uploads).toHaveLength(2)
    expect(uploads[1].path).toBe(setup ? '/init/restore' : '/backups/rollback')
    expect(uploads[1].body.get('decryptionKey')).toBe('saved-private-key')
    expect(await (uploads[1].body.get('file') as File).text()).toBe(
      'MXBACKUP encrypted archive',
    )
  },
)

it.each([true, false])(
  'restores a legacy ZIP without asking for a key in setup=%s',
  async (setup) => {
    await mount(setup)
    await selectFile('PK\u0003\u0004 legacy archive', 'backup.zip')
    expect(document.querySelector('textarea')).toBeNull()
    expect(uploads).toHaveLength(1)
    expect(uploads[0].body.get('decryptionKey')).toBeNull()
  },
)
