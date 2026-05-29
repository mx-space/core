import type { TranslationKey } from '~/i18n/types'

import { EventScope } from '~/api/webhooks'

type Translator = (key: TranslationKey) => string

export function getScopeText(scope: number, t: Translator) {
  const scopes: string[] = []
  if ((scope & EventScope.TO_VISITOR) === EventScope.TO_VISITOR) {
    scopes.push(t('webhooks.scope.short.visitor'))
  }
  if ((scope & EventScope.TO_ADMIN) === EventScope.TO_ADMIN) {
    scopes.push(t('webhooks.scope.short.admin'))
  }
  if ((scope & EventScope.TO_SYSTEM) === EventScope.TO_SYSTEM) {
    scopes.push(t('webhooks.scope.short.system'))
  }
  return scopes.join(', ') || t('webhooks.scope.none')
}

export function getEventColorClass(event: string) {
  if (event === 'all') {
    return 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
  }
  if (event.includes('create')) {
    return 'bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400'
  }
  if (event.includes('update')) {
    return 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
  }
  if (event.includes('delete')) {
    return 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
  }
  return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
}

export function formatJson(content: unknown) {
  if (!content) return ''
  if (typeof content === 'string') {
    try {
      return JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      return content
    }
  }
  return JSON.stringify(content, null, 2)
}

export function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
