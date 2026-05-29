import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { InitDefaultConfigs } from '~/api/system'

import { checkInit, getInitDefaultConfigs } from '~/api/system'
import { bgUrl } from '~/constants/env'
import { useI18n } from '~/i18n'
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
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-neutral-950 p-4 text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10,10,10,.42), rgba(10,10,10,.58)), url(${bgUrl})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div className="mb-8 flex items-center gap-3">
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
                'flex size-10 items-center justify-center rounded-full transition-all',
                isActive
                  ? 'bg-white/90 text-neutral-900'
                  : isCompleted
                    ? 'cursor-pointer bg-white/40 text-white hover:bg-white/50'
                    : 'cursor-not-allowed bg-white/10 text-white/40',
              )}
              disabled={index > step}
              key={item.titleKey}
              onClick={() => {
                if (index < step) setStep(index)
              }}
              type="button"
            >
              {isCompleted ? (
                <Check aria-hidden="true" className="size-5" />
              ) : (
                <Icon className="size-5" />
              )}
            </button>
          )
        })}
      </div>

      <h1 className="mb-2 text-xl font-medium tracking-wide drop-shadow-lg">
        {t(setupSteps[step].titleKey)}
      </h1>
      <p className="mb-8 text-sm text-white/70">
        {t(setupSteps[step].descriptionKey)}
      </p>

      <div className="w-full max-w-md">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
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
          <SetupOwnerStep onNext={() => setStep(3)} onPrev={() => setStep(1)} />
        ) : (
          <SetupCompleteStep onPrev={() => setStep(2)} />
        )}
      </div>
    </main>
  )
}
