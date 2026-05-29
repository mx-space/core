import type { TranslationKey } from '~/i18n/types'
import type { BadgeTone } from '~/ui/primitives/badge'

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

export function getEventTone(event: string): BadgeTone {
  if (event === 'all') return 'info'
  if (event.includes('create')) return 'success'
  if (event.includes('update')) return 'warning'
  if (event.includes('delete')) return 'danger'
  return 'neutral'
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
