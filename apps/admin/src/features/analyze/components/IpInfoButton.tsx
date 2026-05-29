import { Globe2 } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { IPInfo } from '../types/analyze'

import { callBuiltInFunction } from '~/api/system'
import { useI18n } from '~/i18n'

import { getErrorMessage } from '../utils/analyze'

export function IpInfoButton(props: { ip: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<IPInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (info || loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await callBuiltInFunction<IPInfo>('ip', { ip: props.ip })
      setInfo(result)
    } catch (requestError) {
      setError(getErrorMessage(requestError, t('analyze.ip.error')))
    } finally {
      setLoading(false)
    }
  }

  const show = () => {
    setOpen(true)
    void load()
  }

  return (
    <span
      className="relative inline-flex"
      onBlur={() => setOpen(false)}
      onFocus={show}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="inline-flex h-7 items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-2 font-mono text-xs text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-950"
        type="button"
      >
        <Globe2 aria-hidden="true" className="size-3.5 text-neutral-400" />
        {props.ip}
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-20 mt-2 w-72 rounded border border-neutral-200 bg-white p-3 text-left text-xs shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
          {loading ? (
            <span className="text-neutral-500 dark:text-neutral-400">
              {t('analyze.ip.loading')}
            </span>
          ) : error ? (
            <span className="text-red-500">{error}</span>
          ) : info ? (
            <IpInfoContent info={info} />
          ) : (
            <span className="text-neutral-500 dark:text-neutral-400">
              {t('analyze.ip.empty')}
            </span>
          )}
        </span>
      ) : null}
    </span>
  )
}

function IpInfoContent(props: { info: IPInfo }) {
  const { t } = useI18n()
  const city = [
    props.info.countryName,
    props.info.regionName,
    props.info.cityName,
  ]
    .filter(Boolean)
    .join(' - ')

  return (
    <div className="grid gap-2 text-neutral-600 dark:text-neutral-300">
      <InfoLine label="IP">{props.info.ip}</InfoLine>
      <InfoLine label={t('analyze.ip.field.city')}>{city || 'N/A'}</InfoLine>
      <InfoLine label="ISP">{props.info.ispDomain || 'N/A'}</InfoLine>
      <InfoLine label={t('analyze.ip.field.org')}>
        {props.info.ownerDomain || 'N/A'}
      </InfoLine>
      <InfoLine label={t('analyze.ip.field.range')}>
        {props.info.range?.from || props.info.range?.to
          ? `${props.info.range.from ?? '?'} - ${props.info.range.to ?? '?'}`
          : 'N/A'}
      </InfoLine>
    </div>
  )
}

function InfoLine(props: { children: ReactNode; label: string }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
      <span className="text-neutral-400 dark:text-neutral-500">
        {props.label}
      </span>
      <span className="min-w-0 break-words">{props.children}</span>
    </div>
  )
}
