import { Mail, MailOpen, Megaphone } from 'lucide-react'
import type { TranslationKey } from '~/i18n/types'
import type { LucideIcon } from 'lucide-react'
import type { TemplateType, TemplateViewMode } from './types/templates'

export const templateQueryKey = ['templates', 'email'] as const

export const VIEW_MODE_STORAGE_KEY = 'templates.viewMode'

export interface TemplateDescriptor {
  value: TemplateType
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  icon: LucideIcon
}

export const templateDescriptors: TemplateDescriptor[] = [
  {
    value: 'guest',
    labelKey: 'templates.type.guest',
    descriptionKey: 'templates.type.guestDescription',
    icon: Mail,
  },
  {
    value: 'owner',
    labelKey: 'templates.type.owner',
    descriptionKey: 'templates.type.ownerDescription',
    icon: MailOpen,
  },
  {
    value: 'newsletter',
    labelKey: 'templates.type.newsletter',
    descriptionKey: 'templates.type.newsletterDescription',
    icon: Megaphone,
  },
]

export const VIEW_MODES: TemplateViewMode[] = ['split', 'code', 'preview']

export const DEFAULT_VIEW_MODE: TemplateViewMode = 'split'
