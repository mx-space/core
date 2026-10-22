import { PartyPopper, Rocket, Settings, User } from 'lucide-react'
import type { ComponentType } from 'react'

import type { TranslationKey } from '~/i18n/types'

export const inputClassName =
  'h-[42px] rounded-full px-4 text-sm focus-visible:ring-accent/25'

export const labelClassName = 'mb-2 block text-sm font-medium text-fg'

export const primaryButtonClassName =
  'inline-flex h-[42px] items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-white shadow-xs transition-colors hover:bg-accent-hover focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50'

export const secondaryButtonClassName =
  'inline-flex h-[42px] items-center justify-center rounded-full border border-border bg-surface-card px-6 text-sm text-fg shadow-xs transition-colors hover:bg-surface-inset focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50'

export const cardClassName =
  'rounded-2xl border border-border bg-surface-card/80 p-6 shadow-sm backdrop-blur-xl'

export const iconTileClassName =
  'mb-4 flex size-24 items-center justify-center rounded-full bg-surface-card text-accent shadow-brand'

export const setupSteps: Array<{
  descriptionKey: TranslationKey
  icon: ComponentType<{ className?: string }>
  titleKey: TranslationKey
}> = [
  {
    descriptionKey: 'setup.steps.start.description',
    icon: Rocket,
    titleKey: 'setup.steps.start.title',
  },
  {
    descriptionKey: 'setup.steps.site.description',
    icon: Settings,
    titleKey: 'setup.steps.site.title',
  },
  {
    descriptionKey: 'setup.steps.owner.description',
    icon: User,
    titleKey: 'setup.steps.owner.title',
  },
  {
    descriptionKey: 'setup.steps.complete.description',
    icon: PartyPopper,
    titleKey: 'setup.steps.complete.title',
  },
]
