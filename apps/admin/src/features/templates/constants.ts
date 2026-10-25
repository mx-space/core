import type { LucideIcon } from 'lucide-react'
import { Mail, MailOpen, Megaphone } from 'lucide-react'

import type { TranslationKey } from '~/i18n/types'

import type { TemplateType } from './types/templates'

/**
 * Persisted split layout id (`useDefaultLayout` → localStorage).
 * Versioned so a changed panel set starts from a clean default.
 */
export const TEMPLATE_SPLIT_STORAGE_ID = 'templates.split.v1'

export const TEMPLATE_EDITOR_PANEL_ID = 'templates-editor-pane'
export const TEMPLATE_PREVIEW_PANEL_ID = 'templates-preview-pane'

/** Reset target for double-clicking the splitter. */
export const TEMPLATE_SPLIT_DEFAULT = '50%'

/** Below this the editor stops being usable; the preview copes by scaling. */
export const TEMPLATE_PANE_MIN_SIZE = '26%'

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
