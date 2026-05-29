import type { InitResponse } from '../types/login'

import { API_URL } from '~/constants/env'

import { isInitEnvelope } from './login'

export async function checkIsInit() {
  const injectInit = window.injectData?.INIT
  if (typeof injectInit === 'boolean') return injectInit

  const response = await fetch(`${API_URL}/init`, {
    credentials: 'include',
    headers: {
      'x-skip-translation': '1',
    },
  })

  if (response.status === 403 || response.status === 404) return true
  if (!response.ok) return false

  try {
    const data = (await response.json()) as
      | InitResponse
      | { data?: InitResponse }
    if (isInitEnvelope(data)) return data.data?.isInit === true

    return data.isInit === true
  } catch {
    return false
  }
}
