import { API_URL } from '~/constants/env'

export function resolveAuthBaseURL(apiURL = API_URL, origin = location.origin) {
  const baseURL = (apiURL || origin).replace(/\/$/, '')

  return `${baseURL}/auth`
}
