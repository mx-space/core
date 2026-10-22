import { PartyPopper, Rocket, Settings, User } from 'lucide-react'
import type { ComponentType } from 'react'

import type { TranslationKey } from '~/i18n/types'

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
