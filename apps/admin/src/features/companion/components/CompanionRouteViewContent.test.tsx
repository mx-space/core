import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CompanionCapabilities,
  CompanionDevice,
  CompanionPublicPresenceResult,
} from '~/api/companion'
import {
  createCompanionPairing,
  getCompanionCapabilities,
  getCompanionDevices,
  getCompanionPublicPresence,
  revokeCompanionDevice,
} from '~/api/companion'
import { UI_LOCALE_STORAGE_KEY } from '~/constants/keys'
import { I18nProvider } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'

import { CompanionRouteViewContent } from './CompanionRouteViewContent'

vi.mock('~/api/companion', () => ({
  createCompanionPairing: vi.fn(),
  getCompanionCapabilities: vi.fn(),
  getCompanionDevices: vi.fn(),
  getCompanionPublicPresence: vi.fn(),
  revokeCompanionDevice: vi.fn(),
}))

vi.mock('~/ui/feedback/confirm', () => ({
  confirmDialog: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('~/ui/primitives/scroll', () => ({
  Scroll: (props: { children: React.ReactNode }) =>
    createElement('div', null, props.children),
}))

const enabledCapabilities: CompanionCapabilities = {
  features: {
    liveDesk: true,
    mediaTimeline: false,
    moments: false,
    readingSessions: false,
  },
  limits: {
    maximumClockSkewSeconds: 30,
    presenceLeaseMaxSeconds: 60,
    presenceLeaseMinSeconds: 15,
    presencePayloadBytes: 16_384,
    presenceRequestsPerMinute: 120,
    recommendedHeartbeatSeconds: 20,
  },
  minimumClientVersion: '1.0.0',
  momentSchemaVersions: [],
  presenceSchemaVersions: [2],
}

const activeDevice: CompanionDevice = {
  createdAt: '2026-07-16T01:00:00.000Z',
  id: 'b879969f-f19a-4b70-955e-e57f5df87885',
  lastSeenAt: '2026-07-16T01:05:00.000Z',
  name: 'Studio Mac',
  revokedAt: null,
  scopes: ['companion:presence:write'],
}

const emptyPresence: CompanionPublicPresenceResult = {
  state: {
    epoch: '2abf622c-f99d-4df5-93a8-01a5ace9aa33',
    projection: null,
    revision: 0,
    schemaVersion: 2,
  },
}

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function renderRoute(harness: Harness) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  act(() => {
    harness.root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            I18nProvider,
            null,
            createElement(CompanionRouteViewContent),
          ),
        ),
      ),
    )
  })
}

async function flush() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })
  }
}

function getButton(harness: Harness, testId: string) {
  return harness.container.querySelector<HTMLButtonElement>(
    `[data-testid="${testId}"]`,
  )
}

let harness: Harness
let queryClient: QueryClient

beforeEach(() => {
  harness = mount()
  localStorage.setItem(UI_LOCALE_STORAGE_KEY, 'en-US')
  vi.mocked(getCompanionCapabilities).mockResolvedValue(enabledCapabilities)
  vi.mocked(getCompanionDevices).mockResolvedValue([])
  vi.mocked(getCompanionPublicPresence).mockResolvedValue(emptyPresence)
  vi.mocked(confirmDialog).mockResolvedValue(false)
})

afterEach(() => {
  harness.unmount()
  queryClient.clear()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('CompanionRouteViewContent', () => {
  it('distinguishes a paired credential from a successful report', async () => {
    vi.mocked(getCompanionDevices).mockResolvedValue([activeDevice])

    renderRoute(harness)
    await flush()

    const device = harness.container.querySelector(
      `[data-testid="companion-device-${activeDevice.id}"]`,
    )
    expect(device?.textContent).toContain('Paired')
    expect(device?.textContent).toContain('Last authenticated request')
    expect(
      harness.container.querySelector(
        '[data-testid="companion-public-presence-status"]',
      )?.textContent,
    ).toBe('No report')
  })

  it('shows a live accepted projection with its revision and sanitized application', async () => {
    const now = Date.now()
    vi.mocked(getCompanionPublicPresence).mockResolvedValue({
      state: {
        epoch: emptyPresence.state.epoch,
        projection: {
          application: {
            activity: null,
            displayName: 'Safari',
            icon: null,
            window: { title: 'Yohaku' },
          },
          availability: 'active',
          expiresAt: new Date(now + 60_000).toISOString(),
          media: null,
          updatedAt: new Date(now - 1_000).toISOString(),
        },
        revision: 7,
        schemaVersion: 2,
      },
    })

    renderRoute(harness)
    await flush()

    expect(
      harness.container.querySelector(
        '[data-testid="companion-public-presence-status"]',
      )?.textContent,
    ).toBe('Live')
    expect(
      harness.container.querySelector(
        '[data-testid="companion-public-presence-application"]',
      )?.textContent,
    ).toBe('Safari')
    expect(
      harness.container.querySelector(
        '[data-testid="companion-public-presence"]',
      )?.textContent,
    ).toContain('Revision 7')
  })

  it('shows an expired state after a previously published projection is gone', async () => {
    vi.mocked(getCompanionPublicPresence).mockResolvedValue({
      state: { ...emptyPresence.state, revision: 8 },
    })

    renderRoute(harness)
    await flush()

    expect(
      harness.container.querySelector(
        '[data-testid="companion-public-presence-status"]',
      )?.textContent,
    ).toBe('Expired')
  })

  it('refreshes capabilities, devices, and the public projection together', async () => {
    renderRoute(harness)
    await flush()

    expect(getCompanionCapabilities).toHaveBeenCalledTimes(1)
    expect(getCompanionDevices).toHaveBeenCalledTimes(1)
    expect(getCompanionPublicPresence).toHaveBeenCalledTimes(1)

    act(() => getButton(harness, 'companion-refresh')?.click())
    await flush()

    expect(getCompanionCapabilities).toHaveBeenCalledTimes(2)
    expect(getCompanionDevices).toHaveBeenCalledTimes(2)
    expect(getCompanionPublicPresence).toHaveBeenCalledTimes(2)
  })

  it('polls the public projection at the heartbeat-derived interval', async () => {
    vi.useFakeTimers()

    try {
      renderRoute(harness)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(getCompanionPublicPresence).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(9_999)
      })
      expect(getCompanionPublicPresence).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(getCompanionPublicPresence).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps Live Desk reporting and pairing independent from capability metadata loading', async () => {
    vi.mocked(getCompanionCapabilities).mockRejectedValue(
      new Error('capabilities unavailable'),
    )

    renderRoute(harness)
    await flush()

    expect(getCompanionPublicPresence).toHaveBeenCalledOnce()
    expect(getButton(harness, 'companion-create-pairing')?.disabled).toBe(false)
    expect(
      harness.container.querySelector(
        '[data-testid="companion-public-presence-status"]',
      )?.textContent,
    ).toBe('No report')
    expect(harness.container.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('creates and copies a page-session pairing code', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })
    vi.mocked(createCompanionPairing).mockResolvedValue({
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      pairingCode: 'ABCD-EFGH',
      pairingId: '02ea9454-76ba-4054-86c4-aceb18a198f7',
    })

    renderRoute(harness)
    await flush()

    act(() => getButton(harness, 'companion-create-pairing')?.click())
    await flush()

    expect(createCompanionPairing).toHaveBeenCalledOnce()
    expect(
      harness.container.querySelector('[data-testid="companion-pairing-code"]')
        ?.textContent,
    ).toBe('ABCD-EFGH')

    act(() => getButton(harness, 'companion-copy-code')?.click())
    await flush()
    expect(clipboardWrite).toHaveBeenCalledWith('ABCD-EFGH')
  })

  it('requires confirmation before revoking an active device', async () => {
    vi.mocked(getCompanionDevices).mockResolvedValue([activeDevice])
    vi.mocked(revokeCompanionDevice).mockResolvedValue({
      deviceId: activeDevice.id,
      revokedAt: '2026-07-16T02:00:00.000Z',
    })

    renderRoute(harness)
    await flush()

    act(() =>
      getButton(harness, `companion-revoke-${activeDevice.id}`)?.click(),
    )
    await flush()
    expect(revokeCompanionDevice).not.toHaveBeenCalled()

    vi.mocked(confirmDialog).mockResolvedValue(true)
    act(() =>
      getButton(harness, `companion-revoke-${activeDevice.id}`)?.click(),
    )
    await flush()

    expect(vi.mocked(revokeCompanionDevice).mock.calls[0]?.[0]).toBe(
      activeDevice.id,
    )
    expect(getCompanionDevices).toHaveBeenCalledTimes(2)
  })

  it('prevents a revoked device from being revoked again', async () => {
    vi.mocked(getCompanionDevices).mockResolvedValue([
      { ...activeDevice, revokedAt: '2026-07-16T02:00:00.000Z' },
    ])

    renderRoute(harness)
    await flush()

    const revokeButton = getButton(
      harness,
      `companion-revoke-${activeDevice.id}`,
    )
    expect(revokeButton?.disabled).toBe(true)
    act(() => revokeButton?.click())
    await flush()
    expect(confirmDialog).not.toHaveBeenCalled()
  })
})
