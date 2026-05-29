export type UpdateRepo = 'mx-admin' | 'mx-server'

export interface GitHubReleaseDetails {
  body: string | null
  htmlUrl: string
  name: string | null
  publishedAt: string | null
  tagName: string
}

interface GitHubReleaseResponse {
  body: string | null
  html_url: string
  name: string | null
  published_at: string | null
  tag_name: string
}

export interface GitHubUpdateVersions {
  dashboard: string
  dashboardRelease: GitHubReleaseDetails
  system: string
  systemRelease: GitHubReleaseDetails
}

export async function checkUpdateFromGitHub(): Promise<GitHubUpdateVersions> {
  const [systemRelease, dashboardRelease] = await Promise.all([
    fetchRelease('mx-server', 'latest'),
    fetchRelease('mx-admin', 'latest'),
  ])

  return {
    dashboard: normalizeVersion(dashboardRelease.tagName),
    dashboardRelease,
    system: normalizeVersion(systemRelease.tagName),
    systemRelease,
  }
}

export function getReleaseDetails(repo: UpdateRepo, version: string) {
  return fetchRelease(repo, `tags/v${normalizeVersion(version)}`)
}

async function fetchRelease(repo: UpdateRepo, release: 'latest' | string) {
  const response = await fetch(
    `https://api.github.com/repos/mx-space/${repo}/releases/${release}`,
    {
      headers: {
        accept: 'application/vnd.github+json',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`GitHub release request failed: ${response.status}`)
  }

  return mapRelease((await response.json()) as GitHubReleaseResponse)
}

function mapRelease(release: GitHubReleaseResponse): GitHubReleaseDetails {
  return {
    body: release.body,
    htmlUrl: release.html_url,
    name: release.name,
    publishedAt: release.published_at,
    tagName: release.tag_name,
  }
}

function normalizeVersion(version: string) {
  return version.replace(/^v/, '')
}
