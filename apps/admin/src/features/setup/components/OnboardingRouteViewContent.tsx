import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { checkLogged } from '~/api/auth'
import { getOwner } from '~/api/options'
import { checkIsInit } from '~/features/auth/utils/check-init'
import { authBackdropClassName, authBackdropStyle } from '~/lib/auth-backdrop'
import { cn } from '~/utils/cn'

import type { OnboardingStep } from '../utils/onboarding'
import {
  claimPendingOnboarding,
  readOnboardingProgress,
  resolveResumeStep,
  writeOnboardingProgress,
} from '../utils/onboarding'
import { AccountStep } from './AccountStep'
import { AiFeaturesStep } from './AiFeaturesStep'
import { AiModelsStep } from './AiModelsStep'
import { AiProvidersStep } from './AiProvidersStep'
import { ReadyStep } from './ReadyStep'
import { SiteStep } from './SiteStep'
import { WelcomeStep } from './WelcomeStep'

export function OnboardingRouteViewContent() {
  const navigate = useNavigate()
  const [step, setStep] = useState<OnboardingStep | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      let isInit: boolean
      try {
        isInit = await checkIsInit()
      } catch {
        if (!cancelled) {
          setConnected(false)
          setStep('welcome')
        }
        return
      }
      if (!isInit) {
        if (!cancelled) setStep('welcome')
        return
      }

      const logged = await checkLogged().catch(() => null)
      if (cancelled) return
      if (!logged?.ok) {
        navigate(`/login?from=${encodeURIComponent('/setup')}`, {
          replace: true,
        })
        return
      }
      const owner = await getOwner().catch(() => null)
      if (cancelled) return
      if (!owner) {
        navigate('/login', { replace: true })
        return
      }
      const resumeStep = resolveResumeStep(
        readOnboardingProgress(owner.id) ?? claimPendingOnboarding(owner.id),
      )
      if (!resumeStep) {
        navigate('/dashboard', { replace: true })
        return
      }
      setOwnerId(owner.id)
      setStep(resumeStep)
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const go = (next: OnboardingStep, id = ownerId) => {
    setStep(next)
    if (id) {
      writeOnboardingProgress(id, {
        status: next === 'ready' ? 'finished' : 'active',
        step: next,
      })
    }
  }

  const later = () => navigate('/dashboard')

  switch (step) {
    case null: {
      return (
        <main
          className={cn(
            authBackdropClassName,
            'flex items-center justify-center',
          )}
          style={authBackdropStyle}
        >
          <Loader2
            aria-hidden="true"
            className="size-5 animate-spin text-fg-subtle"
          />
        </main>
      )
    }
    case 'welcome': {
      return <WelcomeStep connected={connected} onFresh={() => go('account')} />
    }
    case 'account': {
      return (
        <AccountStep
          onBack={() => go('welcome')}
          onCreated={(id) => {
            setOwnerId(id)
            go('site', id)
          }}
        />
      )
    }
    case 'site': {
      return <SiteStep onLater={later} onNext={() => go('ai-providers')} />
    }
    case 'ai-providers': {
      return (
        <AiProvidersStep
          onBack={() => go('site')}
          onLater={later}
          onNext={() => go('ai-models')}
          onSkip={() => go('ready')}
        />
      )
    }
    case 'ai-models': {
      return (
        <AiModelsStep
          onBack={() => go('ai-providers')}
          onLater={later}
          onNext={() => go('ai-features')}
        />
      )
    }
    case 'ai-features': {
      return (
        <AiFeaturesStep
          onBack={() => go('ai-models')}
          onLater={later}
          onNext={() => go('ready')}
        />
      )
    }
    case 'ready': {
      return <ReadyStep onFinish={() => navigate('/dashboard')} />
    }
  }
}
