import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { CompanionDevice, CompanionPairingResult } from '~/api/companion'
import {
  createCompanionPairing,
  getCompanionCapabilities,
  getCompanionDevices,
  getCompanionPublicPresence,
  revokeCompanionDevice,
} from '~/api/companion'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { CompanionCapabilityPanel } from './CompanionCapabilityPanel'
import { CompanionDeviceList } from './CompanionDeviceList'
import { CompanionLiveDeskPanel } from './CompanionLiveDeskPanel'
import { CompanionPairingPanel } from './CompanionPairingPanel'

const DEVICE_PAIRING_REFETCH_INTERVAL_MS = 5_000
const LIVE_DESK_REFETCH_INTERVAL_MIN_MS = 5_000
const LIVE_DESK_REFETCH_INTERVAL_MAX_MS = 10_000

export function CompanionRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [pairing, setPairing] = useState<CompanionPairingResult | null>(null)

  const capabilitiesQuery = useQuery({
    queryFn: getCompanionCapabilities,
    queryKey: adminQueryKeys.companion.capabilities(),
    retry: false,
  })
  const liveDeskRefetchInterval = Math.min(
    LIVE_DESK_REFETCH_INTERVAL_MAX_MS,
    Math.max(
      LIVE_DESK_REFETCH_INTERVAL_MIN_MS,
      (capabilitiesQuery.data?.limits.recommendedHeartbeatSeconds ?? 20) * 500,
    ),
  )
  const devicesQuery = useQuery({
    queryFn: getCompanionDevices,
    queryKey: adminQueryKeys.companion.devices(),
    refetchInterval: () =>
      pairing && Date.parse(pairing.expiresAt) > Date.now()
        ? DEVICE_PAIRING_REFETCH_INTERVAL_MS
        : false,
  })
  const publicPresenceQuery = useQuery({
    queryFn: getCompanionPublicPresence,
    queryKey: adminQueryKeys.companion.publicPresence(),
    refetchInterval: liveDeskRefetchInterval,
    retry: false,
  })

  const createPairingMutation = useMutation({
    mutationFn: createCompanionPairing,
    onError: () => toast.error(t('companion.pairing.createFailed')),
    onSuccess: (createdPairing) => {
      setPairing(createdPairing)
      toast.success(t('companion.pairing.created'))
    },
  })

  const refreshDevices = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.companion.devices(),
    })
  }

  const revokeDeviceMutation = useMutation({
    mutationFn: revokeCompanionDevice,
    onError: async () => {
      toast.error(t('companion.devices.revokeFailed'))
      await refreshDevices()
    },
    onSuccess: async () => {
      toast.success(t('companion.devices.revokeSuccess'))
      await refreshDevices()
    },
  })

  const handleRefresh = async () => {
    await Promise.all([
      capabilitiesQuery.refetch(),
      devicesQuery.refetch(),
      publicPresenceQuery.refetch(),
    ])
  }

  const handleCopyPairingCode = async (code: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable.')
      }
      await navigator.clipboard.writeText(code)
      toast.success(t('companion.pairing.copied'))
    } catch {
      toast.error(t('companion.pairing.copyFailed'))
    }
  }

  const handleRevoke = async (device: CompanionDevice) => {
    const confirmed = await confirmDialog({
      confirmText: t('companion.devices.revoke'),
      description: t('companion.devices.confirmDescription', {
        name: device.name,
      }),
      destructive: true,
      title: t('companion.devices.confirmTitle'),
    })

    if (confirmed) revokeDeviceMutation.mutate(device.id)
  }

  const isRefreshing =
    capabilitiesQuery.isFetching ||
    devicesQuery.isFetching ||
    publicPresenceQuery.isFetching

  return (
    <AppPage>
      <PageHeader
        actions={
          <Button
            data-testid="companion-refresh"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
            type="button"
            variant="secondary"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn('size-3.5', isRefreshing && 'animate-spin')}
            />
            {t('companion.action.refresh')}
          </Button>
        }
        description={t('routes.companion.description')}
        title={t('routes.companion.title')}
      />

      <Scroll
        className="min-h-0 flex-1"
        innerClassName="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6"
      >
        <CompanionCapabilityPanel
          capabilities={capabilitiesQuery.data}
          isError={capabilitiesQuery.isError}
          isLoading={capabilitiesQuery.isLoading}
          onRetry={() => void capabilitiesQuery.refetch()}
        />
        <CompanionLiveDeskPanel
          isError={publicPresenceQuery.isError}
          isLoading={publicPresenceQuery.isLoading}
          onRetry={() => void handleRefresh()}
          presence={publicPresenceQuery.data}
        />
        <CompanionPairingPanel
          isCreating={createPairingMutation.isPending}
          key={pairing?.pairingId ?? 'no-pairing'}
          onCopy={(code) => void handleCopyPairingCode(code)}
          onCreate={() => createPairingMutation.mutate()}
          pairing={pairing}
        />
        <CompanionDeviceList
          devices={devicesQuery.data ?? []}
          isError={devicesQuery.isError}
          isLoading={devicesQuery.isLoading}
          onRetry={() => void devicesQuery.refetch()}
          onRevoke={(device) => void handleRevoke(device)}
          revokingDeviceId={
            revokeDeviceMutation.isPending
              ? revokeDeviceMutation.variables
              : null
          }
        />
      </Scroll>
    </AppPage>
  )
}
