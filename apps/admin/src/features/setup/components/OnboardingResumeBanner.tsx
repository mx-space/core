import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'

import { getOwner } from '~/api/options'
import { ownerQueryKey } from '~/features/auth/constants'
import { useI18n } from '~/i18n'
import { Button, ButtonLink } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import {
  claimPendingOnboarding,
  readOnboardingProgress,
  writeOnboardingProgress,
} from '../utils/onboarding'

export function OnboardingResumeBanner(props: { className?: string }) {
  const { t } = useI18n()
  const ownerQuery = useQuery({ queryFn: getOwner, queryKey: ownerQueryKey })
  const [dismissed, setDismissed] = useState(false)
  const ownerId = ownerQuery.data?.id
  const progress = ownerId
    ? (readOnboardingProgress(ownerId) ?? claimPendingOnboarding(ownerId))
    : null

  if (!ownerId || !progress || progress.status !== 'active' || dismissed) {
    return null
  }

  const dismiss = () => {
    writeOnboardingProgress(ownerId, { ...progress, status: 'dismissed' })
    setDismissed(true)
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-card px-4 py-3 shadow-xs',
        props.className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent">
        <Sparkles aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium text-fg">
          {t('setup.onboarding.resume.title')}
        </span>
        <span className="block text-fg-muted">
          {t('setup.onboarding.resume.description')}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          data-testid="onboarding-dismiss"
          onClick={dismiss}
          type="button"
          variant="ghost"
        >
          {t('setup.onboarding.resume.dismiss')}
        </Button>
        <ButtonLink to="/setup">
          {t('setup.onboarding.resume.continue')}
        </ButtonLink>
      </div>
    </div>
  )
}
