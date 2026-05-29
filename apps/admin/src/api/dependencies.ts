import { API_URL } from '../constants/env'
import { translate } from '../i18n/translate'
import { getJson } from './http'

export interface DependencyGraph {
  dependencies: Record<string, string>
}

export interface NpmPackageLatest {
  name: string
  version: string
}

export function getDependencyGraph() {
  return getJson<DependencyGraph>('/dependencies/graph')
}

export function getDependencyInstallUrl(packageNames: string | string[]) {
  return `${API_URL}${getDependencyInstallPath(packageNames)}`
}

function getDependencyInstallPath(packageNames: string | string[]) {
  const names = Array.isArray(packageNames)
    ? packageNames.join(',')
    : packageNames

  const searchParams = new URLSearchParams({
    packageNames: names,
  })

  return `/dependencies/install_deps?${searchParams}`
}

export async function getNpmPackageLatest(name: string) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
  )

  if (!response.ok) {
    throw new Error(translate('api.error.npmLatest', { name }))
  }

  return (await response.json()) as NpmPackageLatest
}
