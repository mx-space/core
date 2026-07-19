import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConfigFormField } from '~/api/options'
import { I18nProvider } from '~/i18n'

import { MEMBERSHIP_WEBHOOK_EVENTS } from '../../utils/membership'
import { MembershipConfigEditor } from './MembershipConfigEditor'

const getMembershipConfigStatusMock = vi.fn()

vi.mock('~/api/membership', () => ({
  getMembershipConfigStatus: () => getMembershipConfigStatusMock(),
}))

vi.mock('~/constants/env', () => ({
  API_URL: 'https://mx.example.com/api/v3',
}))

const fields: ConfigFormField[] = [
  {
    key: 'provider',
    title: 'Payment provider',
    ui: {
      component: 'select',
      options: [
        { label: 'Dodo Payments', value: 'dodo' },
        { label: 'Stripe', value: 'stripe' },
      ],
    },
  },
  {
    key: 'environment',
    title: 'Environment',
    ui: {
      component: 'select',
      options: [
        { label: 'Live mode', value: 'live_mode' },
        { label: 'Test mode', value: 'test_mode' },
      ],
    },
  },
]

interface Harness {
  container: HTMLDivElement
  root: Root
}

let harness: Harness

beforeEach(() => {
  getMembershipConfigStatusMock.mockResolvedValue({
    apiKeyConfigured: true,
    supportedProviders: ['dodo'],
    webhookSigningKeyConfigured: true,
  })
  const container = document.createElement('div')
  document.body.append(container)
  harness = { container, root: createRoot(container) }
})

afterEach(() => {
  act(() => harness.root.unmount())
  harness.container.remove()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('MembershipConfigEditor', () => {
  it('shows the exact endpoint and subscription events required by Dodo', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await act(async () => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            I18nProvider,
            null,
            createElement(MembershipConfigEditor, {
              fields,
              onChange: vi.fn(),
              value: {
                environment: 'live_mode',
                monthlyProductId: 'prod_monthly',
                provider: 'dodo',
              },
            }),
          ),
        ),
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(harness.container.textContent).toContain(
      'https://mx.example.com/api/v3/membership/webhook/dodo',
    )
    for (const event of MEMBERSHIP_WEBHOOK_EVENTS) {
      expect(harness.container.textContent).toContain(event)
    }
    expect(harness.container.textContent).toContain('已完成 4/4 个必要步骤')
  })
})
