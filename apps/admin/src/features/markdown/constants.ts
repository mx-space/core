import type { TranslationKey } from '~/i18n/types'

import { ImportType } from './types/markdown'

export const importTypeOptions: Array<{
  labelKey: TranslationKey
  value: ImportType
}> = [
  { labelKey: 'markdown.type.post', value: ImportType.Post },
  { labelKey: 'markdown.type.note', value: ImportType.Note },
]

export const exportOptions = [
  {
    descriptionKey: 'markdown.export.options.includeYAMLHeader.description',
    id: 'includeYAMLHeader',
    labelKey: 'markdown.export.options.includeYAMLHeader.label',
  },
  {
    descriptionKey: 'markdown.export.options.titleBigTitle.description',
    id: 'titleBigTitle',
    labelKey: 'markdown.export.options.titleBigTitle.label',
  },
  {
    descriptionKey: 'markdown.export.options.filenameSlug.description',
    id: 'filenameSlug',
    labelKey: 'markdown.export.options.filenameSlug.label',
  },
  {
    descriptionKey: 'markdown.export.options.withMetaJson.description',
    id: 'withMetaJson',
    labelKey: 'markdown.export.options.withMetaJson.label',
  },
] as const satisfies ReadonlyArray<{
  descriptionKey: TranslationKey
  id: string
  labelKey: TranslationKey
}>
