import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { getAppInfo, restoreFromBackup } from '~/api/system'
import { API_URL } from '~/constants/env'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { getErrorMessage } from '../utils/setup'
import {
  OnboardingAsideTitle,
  OnboardingCard,
  OnboardingFooter,
  OnboardingShell,
} from './OnboardingShell'

type Choice = 'fresh' | 'restore'

export function WelcomeStep(props: {
  connected: boolean
  onFresh: () => void
}) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [choice, setChoice] = useState<Choice>('fresh')
  const [restoring, setRestoring] = useState(false)
  const infoQuery = useQuery({
    enabled: props.connected,
    queryFn: getAppInfo,
    queryKey: ['onboarding', 'info'],
    retry: false,
  })
  const apiLabel = API_URL || location.origin

  const restore = async (file: File | undefined) => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setRestoring(true)
    try {
      await restoreFromBackup(formData)
      toast.success(t('setup.start.restoreSuccess'))
      setTimeout(() => location.reload(), 1000)
    } catch (error) {
      toast.error(getErrorMessage(error, t('setup.start.restoreError')))
    } finally {
      setRestoring(false)
    }
  }

  const proceed = () => {
    if (choice === 'fresh') props.onFresh()
    else fileInputRef.current?.click()
  }

  const choices: Array<{ description: string; key: Choice; title: string }> = [
    {
      description: t('setup.onboarding.welcome.freshDescription'),
      key: 'fresh',
      title: t('setup.onboarding.welcome.fresh'),
    },
    {
      description: t('setup.onboarding.welcome.restoreDescription'),
      key: 'restore',
      title: t('setup.onboarding.welcome.restore'),
    },
  ]

  const asideRows = [
    [
      t('setup.onboarding.rail.account'),
      t('setup.onboarding.welcome.asideAccount'),
    ],
    [t('setup.onboarding.rail.site'), t('setup.onboarding.welcome.asideSite')],
    [t('setup.onboarding.rail.ai'), t('setup.onboarding.welcome.asideAi')],
  ]

  return (
    <OnboardingShell
      aside={
        <>
          <OnboardingAsideTitle>
            {t('setup.onboarding.welcome.asideTitle')}
          </OnboardingAsideTitle>
          <div className="flex flex-col gap-3 text-sm">
            {asideRows.map(([title, description]) => (
              <div key={title}>
                <div className="font-medium text-fg">{title}</div>
                <div className="text-fg-muted">{description}</div>
              </div>
            ))}
          </div>
        </>
      }
      step="welcome"
    >
      <OnboardingCard
        description={t('setup.onboarding.welcome.description')}
        footer={
          <OnboardingFooter meta={t('setup.onboarding.welcome.duration')}>
            <Button
              data-testid="onboarding-submit"
              disabled={!props.connected || restoring}
              onClick={proceed}
              type="button"
            >
              {t('setup.onboarding.action.continue')}
            </Button>
          </OnboardingFooter>
        }
        title={t('setup.onboarding.welcome.title')}
      >
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              'flex items-center gap-2 rounded-sm px-3 py-2 text-sm',
              props.connected
                ? 'bg-surface-inset text-fg'
                : 'bg-red-50 text-red-700',
            )}
          >
            {props.connected ? (
              <CircleCheck
                aria-hidden="true"
                className="size-4 shrink-0 text-green-600"
              />
            ) : (
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            )}
            <span className="min-w-0 truncate">
              {props.connected
                ? t('setup.onboarding.welcome.connected', { url: apiLabel })
                : t('setup.onboarding.welcome.disconnected', { url: apiLabel })}
              {infoQuery.data?.version ? ` · v${infoQuery.data.version}` : ''}
            </span>
            <Link
              className="ml-auto shrink-0 text-accent hover:text-accent-hover"
              to="/setup-api"
            >
              {t('setup.onboarding.welcome.change')}
            </Link>
          </div>
          {props.connected ? (
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
              {choices.map((item) => (
                <button
                  aria-checked={choice === item.key}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors',
                    choice === item.key
                      ? 'border-accent bg-accent-soft/60 ring-[3px] ring-accent/15'
                      : 'border-border bg-surface-card shadow-xs hover:bg-surface-inset',
                  )}
                  key={item.key}
                  onClick={() => setChoice(item.key)}
                  role="radio"
                  type="button"
                >
                  <span className="text-base font-medium text-fg">
                    {item.title}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <input
            accept=".zip"
            className="hidden"
            onChange={(event) => void restore(event.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
        </div>
      </OnboardingCard>
    </OnboardingShell>
  )
}
