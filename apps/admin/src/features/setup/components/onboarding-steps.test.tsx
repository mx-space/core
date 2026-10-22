import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { act } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getModelList, getModelsByCapability, testConfig } from '~/api/ai'
import { getOption, getOwner, getUrlOptions, patchOption } from '~/api/options'
import { createOwner } from '~/api/system'
import { I18nProvider } from '~/i18n'
import { authClient } from '~/utils/authjs/auth'

import { AccountStep } from './AccountStep'
import { AiFeaturesStep } from './AiFeaturesStep'
import { AiModelsStep } from './AiModelsStep'
import { AiProvidersStep } from './AiProvidersStep'
import { SiteStep } from './SiteStep'

vi.mock('~/api/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/system')>()),
  createOwner: vi.fn(),
}))

vi.mock('~/api/options', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/options')>()),
  getOption: vi.fn(),
  getOwner: vi.fn(),
  getUrlOptions: vi.fn(),
  patchOption: vi.fn(),
  updateOwner: vi.fn(),
}))

vi.mock('~/api/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/ai')>()),
  getModelList: vi.fn(),
  getModelsByCapability: vi.fn(),
  testConfig: vi.fn(),
}))

vi.mock('~/utils/authjs/auth', () => ({
  authClient: { signIn: { username: vi.fn() } },
}))

let container: HTMLDivElement
let root: Root
let queryClient: QueryClient

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
})

afterEach(() => {
  act(() => root.unmount())
  queryClient.clear()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

async function render(node: ReactNode) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>{node}</I18nProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )
  })
  await flush()
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

function input(name: string) {
  const el = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (!el) throw new Error(`missing input ${name}`)
  return el
}

async function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function button(testId: string) {
  const el = container.querySelector<HTMLButtonElement>(
    `[data-testid="${testId}"]`,
  )
  if (!el) throw new Error(`missing button ${testId}`)
  return el
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
  await flush()
}

describe('AccountStep', () => {
  it('keeps submit disabled until the password has 8 characters', async () => {
    await render(<AccountStep onBack={vi.fn()} onCreated={vi.fn()} />)
    await type(input('username'), 'innei')
    await type(input('mail'), 'i@example.com')
    await type(input('password'), 'short')

    expect(button('onboarding-submit').disabled).toBe(true)
  })

  it('creates the owner, signs in and reports the new owner id', async () => {
    vi.mocked(createOwner).mockResolvedValue(undefined)
    vi.mocked(authClient.signIn.username).mockResolvedValue({
      data: {},
      error: null,
    } as never)
    vi.mocked(getOwner).mockResolvedValue({
      id: 'owner-1',
      name: 'innei',
      username: 'innei',
    })
    const onCreated = vi.fn()

    await render(<AccountStep onBack={vi.fn()} onCreated={onCreated} />)
    await type(input('username'), 'innei')
    await type(input('mail'), 'i@example.com')
    await type(input('password'), 'long-enough')
    await click(button('onboarding-submit'))

    expect(createOwner).toHaveBeenCalledWith({
      mail: 'i@example.com',
      name: 'innei',
      password: 'long-enough',
      username: 'innei',
    })
    expect(authClient.signIn.username).toHaveBeenCalledWith({
      password: 'long-enough',
      username: 'innei',
    })
    expect(onCreated).toHaveBeenCalledWith('owner-1')
  })
})

describe('SiteStep', () => {
  it('saves the site name into seo and the derived service urls into url', async () => {
    vi.mocked(getOption).mockResolvedValue({ title: 'Old name' })
    vi.mocked(getUrlOptions).mockResolvedValue({
      adminUrl: '',
      serverUrl: '',
      webUrl: '',
      wsUrl: '',
    })
    vi.mocked(patchOption).mockResolvedValue(undefined)
    const onNext = vi.fn()

    await render(<SiteStep onBack={vi.fn()} onNext={onNext} />)
    expect(input('siteName').value).toBe('Old name')
    await type(input('webUrl'), 'https://blog.example.com')
    await click(button('onboarding-submit'))

    expect(patchOption).toHaveBeenCalledWith('seo', { title: 'Old name' })
    expect(patchOption).toHaveBeenCalledWith(
      'url',
      expect.objectContaining({
        adminUrl: expect.any(String),
        serverUrl: expect.any(String),
        webUrl: 'https://blog.example.com',
        wsUrl: expect.any(String),
      }),
    )
    expect(onNext).toHaveBeenCalled()
  })
})

describe('AiProvidersStep', () => {
  it('lists models, tests the key and saves the provider with its key', async () => {
    vi.mocked(getOption).mockResolvedValue({ providers: [] })
    vi.mocked(getModelList).mockResolvedValue({
      models: [{ id: 'claude-x', name: 'Claude X' }],
    })
    vi.mocked(testConfig).mockResolvedValue(undefined)
    vi.mocked(patchOption).mockResolvedValue(undefined)

    await render(
      <AiProvidersStep onBack={vi.fn()} onNext={vi.fn()} onSkip={vi.fn()} />,
    )
    await click(button('onboarding-preset-anthropic'))
    await type(input('apiKey'), 'sk-test')
    await click(button('onboarding-provider-add'))

    expect(getModelList).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-test', type: 'anthropic' }),
    )
    expect(testConfig).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-test', type: 'anthropic' }),
    )
    expect(patchOption).toHaveBeenCalledWith(
      'ai',
      expect.objectContaining({
        providers: [
          expect.objectContaining({
            apiKey: 'sk-test',
            enabled: true,
            type: 'anthropic',
          }),
        ],
      }),
    )
  })
})

describe('AiModelsStep', () => {
  it('assigns the default model to every text feature on continue', async () => {
    vi.mocked(getOption).mockResolvedValue({
      providers: [
        {
          apiKey: '',
          defaultModel: 'claude-x',
          enabled: true,
          id: 'p1',
          name: 'Anthropic',
          type: 'anthropic',
        },
      ],
    })
    vi.mocked(getModelsByCapability).mockImplementation(async (capability) =>
      capability === 'text'
        ? [
            {
              models: [{ id: 'claude-x', name: 'Claude X' }],
              providerId: 'p1',
              providerName: 'Anthropic',
              providerType: 'anthropic',
            },
          ]
        : [],
    )
    vi.mocked(patchOption).mockResolvedValue(undefined)
    const onNext = vi.fn()

    await render(<AiModelsStep onBack={vi.fn()} onNext={onNext} />)
    await click(button('onboarding-submit'))

    const assignment = { model: 'claude-x', providerId: 'p1' }
    expect(patchOption).toHaveBeenCalledWith(
      'ai',
      expect.objectContaining({
        summaryModel: assignment,
        translationModel: assignment,
        writerModel: assignment,
      }),
    )
    expect(onNext).toHaveBeenCalled()
  })
})

describe('AiFeaturesStep', () => {
  it('saves switches and target languages, and keeps speech off without a model', async () => {
    vi.mocked(getOption).mockResolvedValue({ providers: [] })
    vi.mocked(patchOption).mockResolvedValue(undefined)
    const onNext = vi.fn()

    await render(<AiFeaturesStep onBack={vi.fn()} onNext={onNext} />)

    const speech = container.querySelector<HTMLElement>(
      '[data-testid="onboarding-feature-tts"] [role="switch"]',
    )
    expect(
      speech?.getAttribute('aria-disabled') ??
        speech?.hasAttribute('data-disabled'),
    ).toBeTruthy()

    await click(
      container.querySelector<HTMLElement>(
        '[data-testid="onboarding-feature-translation"] [role="switch"]',
      )!,
    )
    await click(button('onboarding-language-ja'))
    await click(button('onboarding-submit'))

    expect(patchOption).toHaveBeenCalledWith(
      'ai',
      expect.objectContaining({
        enableTranslation: true,
        translationTargetLanguages: ['ja'],
      }),
    )
    expect(onNext).toHaveBeenCalled()
  })
})
