import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { callBuiltInFunction } from '~/api/system'
import { useI18n } from '~/i18n'
import { Popover } from '~/ui/overlay/popover'

interface IpInfo {
  cityName?: string
  countryName?: string
  ip: string
  ispDomain?: string
  ownerDomain?: string
  range?: {
    from?: string
    to?: string
  }
  regionName?: string
}

const ipInfoCache = new Map<string, IpInfo>()

export function IpInfoPopover(props: {
  className?: string
  ip: string
  trigger?: ReactNode
}) {
  const { t } = useI18n()
  const [info, setInfo] = useState<IpInfo | null>(
    () => ipInfoCache.get(props.ip) ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadInfo = async () => {
    if (!props.ip || ipInfoCache.has(props.ip)) {
      setInfo(ipInfoCache.get(props.ip) ?? null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await callBuiltInFunction<IpInfo>('ip', { ip: props.ip })
      ipInfoCache.set(props.ip, result)
      setInfo(result)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('shared.ipInfo.fetchFailed'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) void loadInfo()
      }}
    >
      <Popover.Trigger
        className={
          props.className ??
          'inline-flex min-w-0 items-center gap-1.5 hover:underline'
        }
        type="button"
      >
        {props.trigger ?? (
          <>
            <MapPin
              aria-hidden="true"
              className="size-3.5 shrink-0 text-fg-subtle"
            />
            <span>{props.ip}</span>
          </>
        )}
      </Popover.Trigger>
      <Popover.Content
        align="start"
        className="w-72 p-3 text-xs text-fg-muted"
        side="top"
        sideOffset={8}
      >
        {loading ? (
          <span className="text-fg-subtle">{t('shared.ipInfo.loading')}</span>
        ) : error ? (
          <span className="text-red-500">{error}</span>
        ) : info ? (
          <div className="grid gap-2">
            <InfoRow label="IP" value={info.ip || props.ip} />
            <InfoRow
              label={t('shared.ipInfo.label.city')}
              value={
                [info.countryName, info.regionName, info.cityName]
                  .filter(Boolean)
                  .join(' - ') || 'N/A'
              }
            />
            <InfoRow
              label={t('shared.ipInfo.label.isp')}
              value={info.ispDomain || 'N/A'}
            />
            <InfoRow
              label={t('shared.ipInfo.label.org')}
              value={info.ownerDomain || 'N/A'}
            />
            <InfoRow
              label={t('shared.ipInfo.label.range')}
              value={
                info.range
                  ? [info.range.from, info.range.to]
                      .filter(Boolean)
                      .join(' - ') || 'N/A'
                  : 'N/A'
              }
            />
          </div>
        ) : (
          <span className="text-fg-subtle">{t('shared.ipInfo.empty')}</span>
        )}
      </Popover.Content>
    </Popover>
  )
}

function InfoRow(props: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
      <span className="text-neutral-400">{props.label}</span>
      <span className="min-w-0 break-words text-neutral-800 dark:text-neutral-100">
        {props.value}
      </span>
    </div>
  )
}
