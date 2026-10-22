import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { InitDefaultConfigs } from '~/api/system'
import { checkInit, getInitDefaultConfigs } from '~/api/system'
import { useI18n } from '~/i18n'
import {
  authBackdropClassName,
  authBackdropStyle,
  authCardClassName,
  authDescriptionClassName,
  authTitleClassName,
} from '~/lib/auth-backdrop'
import { cn } from '~/utils/cn'

import { setupSteps } from '../constants'
import { getErrorMessage } from '../utils/setup'
import { SetupCompleteStep } from './SetupCompleteStep'
import { SetupOwnerStep } from './SetupOwnerStep'
import { SetupSiteStep } from './SetupSiteStep'
import { SetupStartStep } from './SetupStartStep'

export function SetupRouteViewContent() {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [defaultConfigs, setDefaultConfigs] = useState<InitDefaultConfigs>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const injected = window.injectData?.INIT
        if (typeof injected !== 'boolean') {
          await checkInit()
        }
        const configs = await getInitDefaultConfigs()
        if (!cancelled) setDefaultConfigs(configs)
      } catch (error) {
        toast.error(getErrorMessage(error, t('setup.route.configReadError')))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <main
      className={cn(
        authBackdropClassName,
        'flex flex-col items-center justify-center',
      )}
      style={authBackdropStyle}
    >
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="mb-6 flex items-center gap-2">
          {setupSteps.map((item, index) => {
            const Icon = item.icon
            const isActive = step === index
            const isCompleted = step > index
            const title = t(item.titleKey)
            const statusSuffix = isCompleted
              ? t('setup.route.stepStatus.completed')
              : isActive
                ? t('setup.route.stepStatus.current')
                : ''

            return (
              <button
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${title}${statusSuffix}`}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                  isActive
                    ? 'bg-accent text-white shadow-xs'
                    : isCompleted
                      ? 'cursor-pointer bg-accent-soft text-accent hover:bg-accent/15'
                      : 'cursor-not-allowed border border-border bg-surface-card text-fg-subtle',
                )}
                disabled={index > step}
                key={item.titleKey}
                onClick={() => {
                  if (index < step) setStep(index)
                }}
                type="button"
              >
                {isCompleted ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </button>
            )
          })}
        </div>

        <section className={authCardClassName}>
          <header className="mb-6">
            <h1 className={authTitleClassName}>
              {t(setupSteps[step].titleKey)}
            </h1>
            <p className={cn(authDescriptionClassName, 'mt-1')}>
              {t(setupSteps[step].descriptionKey)}
            </p>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                aria-hidden="true"
                className="size-5 animate-spin text-fg-subtle"
              />
            </div>
          ) : step === 0 ? (
            <SetupStartStep onNext={() => setStep(1)} />
          ) : step === 1 ? (
            <SetupSiteStep
              defaultConfigs={defaultConfigs}
              onNext={() => setStep(2)}
              onPrev={() => setStep(0)}
            />
          ) : step === 2 ? (
            <SetupOwnerStep
              onNext={() => setStep(3)}
              onPrev={() => setStep(1)}
            />
          ) : (
            <SetupCompleteStep onPrev={() => setStep(2)} />
          )}
        </section>
      </div>
    </main>
  )
}
