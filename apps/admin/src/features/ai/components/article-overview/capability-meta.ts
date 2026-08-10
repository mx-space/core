import type { LucideIcon } from 'lucide-react'
import { AudioLines, FileText, Languages, Sparkles } from 'lucide-react'

import type { AiOverviewCapability } from '~/api/ai-overview'
import type { TranslationKey } from '~/i18n/types'

export const CAPABILITY_META: Record<
  AiOverviewCapability,
  { icon: LucideIcon; labelKey: TranslationKey }
> = {
  summary: { icon: FileText, labelKey: 'ai.overview.capability.summary' },
  insights: { icon: Sparkles, labelKey: 'ai.overview.capability.insights' },
  translation: {
    icon: Languages,
    labelKey: 'ai.overview.capability.translation',
  },
  tts: { icon: AudioLines, labelKey: 'ai.overview.capability.tts' },
}
