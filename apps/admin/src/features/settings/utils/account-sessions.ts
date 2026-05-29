import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { AccountSession } from '../types/settings'

import { authClient } from '~/utils/authjs/auth'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export async function listSessions(t: Translator): Promise<AccountSession[]> {
  const [sessionsResult, currentResult] = await Promise.all([
    authClient.listSessions(),
    authClient.getSession(),
  ])

  if (sessionsResult.error) {
    throw new Error(
      sessionsResult.error.message || t('settings.session.error.listFailed'),
    )
  }

  const currentToken = currentResult.data?.session?.token
  return (sessionsResult.data ?? []).map((session: any) => {
    const token = String(session.token || session.id)
    return {
      current: currentToken ? token === currentToken : false,
      ip: session.ipAddress || '',
      lastActiveAt: new Date(
        session.updatedAt || session.createdAt || Date.now(),
      ).toISOString(),
      token,
      ua: session.userAgent || '',
    }
  })
}
