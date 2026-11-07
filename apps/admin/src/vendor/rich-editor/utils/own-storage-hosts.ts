import { getOption, getUrlOptions } from '~/api/options'
import { API_URL } from '~/constants/env'

export function ownStorageHosts(sources: {
  apiUrl: string
  webUrl?: string
  serverUrl?: string
  customDomain?: string
}): string[] {
  const hosts: string[] = []
  for (const candidate of [
    sources.apiUrl,
    sources.webUrl,
    sources.serverUrl,
    sources.customDomain,
  ]) {
    if (!candidate) continue
    try {
      const { host } = new URL(candidate)
      if (!hosts.includes(host)) hosts.push(host)
    } catch {
      continue
    }
  }
  return hosts
}

export function isOwnStorageUrl(url: string, hosts: readonly string[]) {
  try {
    const parsed = new URL(url)
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      hosts.includes(parsed.host)
    )
  } catch {
    return false
  }
}

export async function loadOwnStorageHosts(): Promise<string[]> {
  const [urls, storage] = await Promise.all([
    getUrlOptions().catch(() => null),
    getOption<{ customDomain?: string }>('imageStorageOptions').catch(
      () => null,
    ),
  ])
  return ownStorageHosts({
    apiUrl: new URL(API_URL, window.location.origin).toString(),
    webUrl: urls?.webUrl,
    serverUrl: urls?.serverUrl,
    customDomain: storage?.customDomain,
  })
}
