import type { ScopeOption } from './types/webhooks'

import { EventScope } from '~/api/webhooks'

export const webhooksQueryKey = ['webhooks'] as const

export const dispatchPageSize = 20

export const scopeOptions: ScopeOption[] = [
  { labelKey: 'webhooks.scope.visitor', value: EventScope.TO_VISITOR },
  { labelKey: 'webhooks.scope.admin', value: EventScope.TO_ADMIN },
  { labelKey: 'webhooks.scope.system', value: EventScope.TO_SYSTEM },
]
