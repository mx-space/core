import { SetMetadata } from '@nestjs/common'

import type { TranslationEntryKeyPath } from '~/modules/ai/ai-translation/translation-entry.model'

export const TRANSLATE_FIELDS_KEY = 'translate_fields'

export interface TranslateFieldRule {
  path: string
  keyPath: TranslationEntryKeyPath
  idField?: 'id'
}

export const TranslateFields = (...rules: TranslateFieldRule[]) =>
  SetMetadata(TRANSLATE_FIELDS_KEY, rules)
