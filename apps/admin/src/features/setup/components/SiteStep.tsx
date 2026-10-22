import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { UrlOptions } from '~/api/options'
import { getOption, getUrlOptions, patchOption } from '~/api/options'
import { API_URL } from '~/constants/env'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import faviconUrl from '../../../../favicon.png'
import { deriveServiceUrls } from '../utils/onboarding'
import { getErrorMessage } from '../utils/setup'
import {
  FieldHint,
  OnboardingAsideTitle,
  OnboardingCard,
  OnboardingFooter,
  OnboardingShell,
} from './OnboardingShell'

type ServiceUrls = Omit<UrlOptions, 'webUrl'>

const serviceKeys = ['serverUrl', 'adminUrl', 'wsUrl'] as const

const seoQueryKey = adminQueryKeys.onboarding.seo()

function readGatewayOverride() {
  try {
    return (
      sessionStorage.getItem('__gateway') ||
      localStorage.getItem('__gateway') ||
      ''
    )
  } catch {
    return ''
  }
}

function isConfiguredUrl(value?: string) {
  if (!value) return false
  try {
    const { hostname } = new URL(value)
    return hostname !== 'localhost' && hostname !== '127.0.0.1'
  } catch {
    return false
  }
}

export function SiteStep(props: {
  onBack?: () => void
  onLater?: () => void
  onNext: () => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const seoQuery = useQuery({
    queryFn: () => getOption<{ title?: string }>('seo'),
    queryKey: seoQueryKey,
  })
  const urlQuery = useQuery({
    queryFn: getUrlOptions,
    queryKey: adminQueryKeys.onboarding.url(),
  })
  const derived = useMemo(
    () =>
      deriveServiceUrls({
        adminHref: location.href.split('#')[0],
        apiUrl: API_URL || location.origin,
        gatewayUrl: readGatewayOverride(),
      }),
    [],
  )
  const [siteName, setSiteName] = useState('')
  const [webUrl, setWebUrl] = useState('')
  const [services, setServices] = useState<ServiceUrls>(derived)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (seoQuery.data?.title) setSiteName(seoQuery.data.title)
  }, [seoQuery.data])

  useEffect(() => {
    const saved = urlQuery.data
    if (!saved) return
    if (isConfiguredUrl(saved.webUrl)) setWebUrl(saved.webUrl)
    setServices((current) => {
      const next = { ...current }
      for (const key of serviceKeys) {
        if (isConfiguredUrl(saved[key])) next[key] = saved[key]
      }
      return next
    })
  }, [urlQuery.data])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const title = siteName.trim()
      if (title) {
        await patchOption('seo', { title })
        queryClient.setQueryData<{ title?: string }>(
          seoQueryKey,
          (current) => ({
            ...current,
            title,
          }),
        )
      }
      const trimmedWebUrl = webUrl.trim()
      await patchOption(
        'url',
        trimmedWebUrl ? { ...services, webUrl: trimmedWebUrl } : services,
      )
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.settings.root,
      })
      props.onNext()
    } catch (error) {
      toast.error(getErrorMessage(error, t('setup.onboarding.site.saveError')))
    } finally {
      setSubmitting(false)
    }
  }

  const serviceRows: Array<{
    key: (typeof serviceKeys)[number]
    label: string
  }> = [
    { key: 'serverUrl', label: t('setup.onboarding.site.serverUrl') },
    { key: 'adminUrl', label: t('setup.onboarding.site.adminUrl') },
    { key: 'wsUrl', label: t('setup.onboarding.site.wsUrl') },
  ]

  return (
    <OnboardingShell
      aside={
        <>
          <OnboardingAsideTitle>
            {t('setup.onboarding.site.asideTitle')}
          </OnboardingAsideTitle>
          <div className="overflow-hidden rounded-sm border border-border bg-white shadow-xs">
            <div className="flex items-center gap-2 border-b border-border bg-surface-inset px-2.5 py-2">
              <img alt="" className="size-3.5 rounded-xs" src={faviconUrl} />
              <span className="truncate text-sm font-medium">
                {siteName || t('setup.onboarding.site.name')}
              </span>
            </div>
            <div className="truncate px-2.5 py-2 text-sm text-fg-muted">
              {webUrl || 'https://'}
            </div>
          </div>
          <p className="mt-3 text-sm text-fg-muted">
            {t('setup.onboarding.site.asideHint')}
          </p>
        </>
      }
      onLater={props.onLater}
      step="site"
    >
      <form className="contents" onSubmit={submit}>
        <OnboardingCard
          description={t('setup.onboarding.site.description')}
          footer={
            <OnboardingFooter onBack={props.onBack}>
              <Button
                data-testid="onboarding-submit"
                disabled={submitting}
                type="submit"
              >
                {t('setup.onboarding.action.continue')}
              </Button>
            </OnboardingFooter>
          }
          title={t('setup.onboarding.site.title')}
        >
          <div className="flex flex-col gap-4">
            <TextInput
              label={t('setup.onboarding.site.name')}
              name="siteName"
              onChange={setSiteName}
              value={siteName}
            />
            <div>
              <TextInput
                autoComplete="url"
                label={t('setup.onboarding.site.webUrl')}
                name="webUrl"
                onChange={setWebUrl}
                placeholder="https://"
                type="url"
                value={webUrl}
              />
              <FieldHint>{t('setup.onboarding.site.webUrlHint')}</FieldHint>
            </div>
            <details className="group rounded-sm border border-border bg-surface-page px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-fg">
                {t('setup.onboarding.site.services')}
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                {serviceRows.map((row) => (
                  <TextInput
                    key={row.key}
                    label={row.label}
                    name={row.key}
                    onChange={(value) =>
                      setServices((current) => ({
                        ...current,
                        [row.key]: value,
                      }))
                    }
                    type="url"
                    value={services[row.key]}
                  />
                ))}
              </div>
            </details>
          </div>
        </OnboardingCard>
      </form>
    </OnboardingShell>
  )
}
