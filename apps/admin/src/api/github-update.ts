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
  draft?: boolean
  prerelease?: boolean
}

export interface GitHubUpdateVersions {
  dashboard: string
  dashboardRelease: GitHubReleaseDetails
  system: string
  systemRelease: GitHubReleaseDetails
}

const MONOREPO = 'mx-space/core'
const ADMIN_PREFIX = 'admin-v'
const SYSTEM_PREFIX = 'v'

export async function checkUpdateFromGitHub(): Promise<GitHubUpdateVersions> {
  const [systemRelease, dashboardRelease] = await Promise.all([
    fetchLatestRelease('mx-server'),
    fetchLatestRelease('mx-admin'),
  ])

  return {
    dashboard: stripPrefix(dashboardRelease.tagName, 'mx-admin'),
    dashboardRelease,
    system: stripPrefix(systemRelease.tagName, 'mx-server'),
    systemRelease,
  }
}

export function getReleaseDetails(repo: UpdateRepo, version: string) {
  const tag =
    repo === 'mx-admin'
      ? `${ADMIN_PREFIX}${normalizeVersion(version)}`
      : `${SYSTEM_PREFIX}${normalizeVersion(version)}`
  return fetchReleaseByTag(tag)
}

async function fetchLatestRelease(
  repo: UpdateRepo,
): Promise<GitHubReleaseDetails> {
  const response = await fetch(
    `https://api.github.com/repos/${MONOREPO}/releases?per_page=50`,
    {
      headers: {
        accept: 'application/vnd.github+json',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`GitHub release request failed: ${response.status}`)
  }

  const releases = (await response.json()) as GitHubReleaseResponse[]
  const match = releases.find(
    (release) =>
      !release.draft &&
      !release.prerelease &&
      matchesRepo(release.tag_name, repo),
  )
  if (!match) {
    throw new Error(`No ${repo} release found in ${MONOREPO}`)
  }
  return mapRelease(match)
}

async function fetchReleaseByTag(tag: string): Promise<GitHubReleaseDetails> {
  const response = await fetch(
    `https://api.github.com/repos/${MONOREPO}/releases/tags/${tag}`,
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

function matchesRepo(tagName: string, repo: UpdateRepo) {
  if (repo === 'mx-admin') return tagName.startsWith(ADMIN_PREFIX)
  return tagName.startsWith(SYSTEM_PREFIX) && !tagName.startsWith(ADMIN_PREFIX)
}

function stripPrefix(tagName: string, repo: UpdateRepo) {
  const prefix = repo === 'mx-admin' ? ADMIN_PREFIX : SYSTEM_PREFIX
  return tagName.startsWith(prefix) ? tagName.slice(prefix.length) : tagName
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
