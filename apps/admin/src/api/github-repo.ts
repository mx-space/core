import { translate } from '../i18n/translate'

const endpoint = 'https://api.github.com/'

export interface GithubRepo {
  name: string
  html_url: string
  description: string | null
  homepage: string | null
}

interface GithubReadme {
  download_url: string
}

export async function getRepoDetail(owner: string, repo: string) {
  const response = await fetch(`${endpoint}repos/${owner}/${repo}`)
  if (!response.ok) throw new Error(translate('api.error.githubRepo'))

  return response.json() as Promise<GithubRepo>
}

export async function getRepoReadme(owner: string, repo: string) {
  const response = await fetch(`${endpoint}repos/${owner}/${repo}/readme`)
  if (!response.ok) return null

  const readme = (await response.json()) as GithubReadme
  if (!readme.download_url) return null

  const split = readme.download_url.split('/')
  const filename = split.pop()
  const branch = split.pop()
  if (!filename || !branch) return null

  const jsdelivrUrl = `https://fastly.jsdelivr.net/gh/${owner}/${repo}@${branch}/${filename}`
  const readmeResponse = await fetch(jsdelivrUrl)
  if (!readmeResponse.ok) return null

  return readmeResponse.text()
}
