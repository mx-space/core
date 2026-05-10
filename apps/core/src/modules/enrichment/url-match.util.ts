import { createHash } from 'node:crypto'

/**
 * DI-free URL → enrichment ref matcher.
 *
 * Mirrors each EnrichmentProvider.matchUrl implementation as a pure function
 * so app-data migrations can derive `{ provider, externalId }` from a URL
 * without booting the full Nest DI graph (no ConfigsService, no GitHubClient,
 * no AiModule, etc.). The live server keeps using `ProviderRegistry.match`
 * via `EnrichmentService.matchUrlToRef`; this utility is the read-only
 * counterpart for offline/migration code paths.
 *
 * Excludes:
 *   - `mx-space` (self-content): needs the configured `siteHost` from
 *     ConfigsService. In migration context we do not have that; self-content
 *     URLs simply fall through to `open-graph`. Live server will re-classify
 *     them on first read.
 *
 * Iteration order follows the registry's priority-desc sort (so the same URL
 * resolves to the same provider regardless of caller). When a provider's
 * pathname guard rejects, the next provider gets a chance — first non-null
 * wins.
 */

const ID_HEX_LENGTH = 32

export interface UrlRef {
  provider: string
  externalId: string
}

export function matchUrlToRef(rawUrl: string): UrlRef | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  // Priority 10
  let m = matchGithubRepo(url)
  if (m) return m
  m = matchTmdb(url)
  if (m) return m
  m = matchBangumi(url)
  if (m) return m
  m = matchNeodbBook(url)
  if (m) return m
  m = matchArxiv(url)
  if (m) return m
  m = matchLeetcode(url)
  if (m) return m
  m = matchNeteaseMusic(url)
  if (m) return m

  // Priority 9
  m = matchGithubPr(url)
  if (m) return m
  m = matchQqMusic(url)
  if (m) return m

  // Priority 8/7/6
  m = matchGithubIssue(url)
  if (m) return m
  m = matchGithubCommit(url)
  if (m) return m
  m = matchGithubDiscussion(url)
  if (m) return m

  // Priority -100 (catchall)
  return matchOpenGraph(url)
}

const splitPath = (url: URL) => url.pathname.split('/').filter(Boolean)

function matchGithubRepo(url: URL): UrlRef | null {
  if (url.hostname !== 'github.com') return null
  const parts = splitPath(url)
  if (parts.length !== 2) return null
  return { provider: 'gh-repo', externalId: `${parts[0]}/${parts[1]}` }
}

function matchGithubPr(url: URL): UrlRef | null {
  if (url.hostname !== 'github.com') return null
  const parts = splitPath(url)
  if (parts.length !== 4 || parts[2] !== 'pull') return null
  return {
    provider: 'gh-pr',
    externalId: `${parts[0]}/${parts[1]}/pulls/${parts[3]}`,
  }
}

function matchGithubIssue(url: URL): UrlRef | null {
  if (url.hostname !== 'github.com') return null
  const parts = splitPath(url)
  if (parts.length !== 4 || parts[2] !== 'issues') return null
  return {
    provider: 'gh-issue',
    externalId: `${parts[0]}/${parts[1]}/issues/${parts[3]}`,
  }
}

function matchGithubCommit(url: URL): UrlRef | null {
  if (url.hostname !== 'github.com') return null
  const parts = splitPath(url)
  if (parts.length !== 4 || parts[2] !== 'commit') return null
  return {
    provider: 'gh-commit',
    externalId: `${parts[0]}/${parts[1]}/commits/${parts[3]}`,
  }
}

function matchGithubDiscussion(url: URL): UrlRef | null {
  if (url.hostname !== 'github.com') return null
  const parts = splitPath(url)
  if (parts.length !== 4 || parts[2] !== 'discussions') return null
  return {
    provider: 'gh-discussion',
    externalId: `${parts[0]}/${parts[1]}/discussions/${parts[3]}`,
  }
}

function matchTmdb(url: URL): UrlRef | null {
  if (
    url.hostname !== 'www.themoviedb.org' &&
    url.hostname !== 'themoviedb.org'
  )
    return null
  const parts = splitPath(url)
  if (parts.length < 2) return null
  const [type, slug] = parts
  if (type !== 'movie' && type !== 'tv') return null
  const id = slug.split('-')[0]
  if (!/^\d+$/.test(id)) return null
  return { provider: 'tmdb', externalId: `${type}/${id}` }
}

function matchBangumi(url: URL): UrlRef | null {
  if (url.hostname !== 'bgm.tv' && url.hostname !== 'bangumi.tv') return null
  const parts = splitPath(url)
  if (parts.length < 2 || parts[0] !== 'subject') return null
  return { provider: 'bangumi', externalId: parts[1] }
}

function matchNeodbBook(url: URL): UrlRef | null {
  if (url.hostname === 'book.douban.com') {
    const parts = splitPath(url)
    if (parts[0] !== 'subject') return null
    return { provider: 'neodb-book', externalId: `douban-book:${parts[1]}` }
  }
  if (url.hostname === 'neodb.social') {
    const parts = splitPath(url)
    if (parts.length < 2) return null
    return { provider: 'neodb-book', externalId: `${parts[0]}/${parts[1]}` }
  }
  return null
}

function matchArxiv(url: URL): UrlRef | null {
  if (url.hostname !== 'arxiv.org') return null
  const m = url.pathname.match(/^\/(abs|pdf)\/([\d.]+(?:v\d+)?)/)
  if (!m) return null
  return { provider: 'arxiv', externalId: m[2] }
}

function matchLeetcode(url: URL): UrlRef | null {
  if (url.hostname !== 'leetcode.com' && url.hostname !== 'leetcode.cn')
    return null
  const parts = splitPath(url)
  if (parts.length < 2 || parts[0] !== 'problems') return null
  return { provider: 'leetcode', externalId: parts[1] }
}

function matchNeteaseMusic(url: URL): UrlRef | null {
  if (url.hostname !== 'music.163.com') return null
  const id = url.searchParams.get('id')
  if (!id) return null
  return { provider: 'netease-music', externalId: id }
}

function matchQqMusic(url: URL): UrlRef | null {
  if (url.hostname !== 'y.qq.com') return null
  const parts = splitPath(url)
  const songIdx = parts.indexOf('songDetail')
  if (songIdx === -1 || songIdx + 1 >= parts.length) return null
  return { provider: 'qq-music', externalId: parts[songIdx + 1] }
}

function matchOpenGraph(url: URL): UrlRef | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname) return null
  const normalized = `${url.origin}${url.pathname}${url.search}`
  const externalId = createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, ID_HEX_LENGTH)
  return { provider: 'open-graph', externalId }
}
