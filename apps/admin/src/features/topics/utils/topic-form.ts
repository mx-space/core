import type { CreateTopicData } from '~/api/topics'
import type { TranslationKey, TranslationValues } from '~/i18n/types'

export function getInitial(value: string) {
  const normalized = value.trim()
  if (!normalized) return '#'
  return normalized.length > 2 ? normalized.slice(0, 2) : normalized
}

export interface TopicFormError {
  key: TranslationKey
  values?: TranslationValues
}

export function validateTopicForm(
  data: CreateTopicData,
): TopicFormError | null {
  if (!data.name) return { key: 'topics.form.validate.nameRequired' }
  if (data.name.length > 50)
    return { key: 'topics.form.validate.nameMax', values: { max: 50 } }
  if (!data.slug) return { key: 'topics.form.validate.slugRequired' }
  if (!/^[\w-]+$/.test(data.slug))
    return { key: 'topics.form.validate.slugPattern' }
  if (!data.introduce) return { key: 'topics.form.validate.introduceRequired' }
  if (data.introduce.length > 100)
    return { key: 'topics.form.validate.introduceMax', values: { max: 100 } }
  if (data.description && data.description.length > 500) {
    return { key: 'topics.form.validate.descriptionMax', values: { max: 500 } }
  }

  return null
}
