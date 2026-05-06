/**
 * Type-safe API response interfaces for all enrichment providers.
 * These define the exact shapes returned by third-party APIs.
 */

// ==================== GitHub ====================

export interface GitHubRepoApiResponse {
  full_name: string
  description: string | null
  html_url: string
  stargazers_count: number | null
  forks_count: number | null
  language: string | null
  created_at: string
  owner: {
    avatar_url: string
    login: string
  } | null
  license: {
    spdx_id: string
  } | null
}

export interface GitHubIssueApiResponse {
  number: number
  title: string
  body: string | null
  html_url: string
  state: string
  comments: number | null
  created_at: string
  user: {
    avatar_url: string
    login: string
  } | null
}

export interface GitHubPullRequestApiResponse {
  number: number
  title: string
  body: string | null
  html_url: string
  state: string
  merged: boolean
  additions: number | null
  deletions: number | null
  created_at: string
  user: {
    avatar_url: string
    login: string
  } | null
}

export interface GitHubCommitApiResponse {
  html_url: string
  commit: {
    message: string
    author: {
      date: string
    } | null
  } | null
  author: {
    avatar_url: string
    login: string
  } | null
  stats: {
    additions: number | null
    deletions: number | null
  } | null
}

export interface GitHubDiscussionSearchApiResponse {
  items: Array<{
    title: string
    body: string | null
    html_url: string
    created_at: string
    comments: number | null
    user: {
      avatar_url: string
      login: string
    } | null
  }> | null
}

// ==================== TMDB ====================

export interface TMDBMovieApiResponse {
  id: number
  title: string
  name?: string
  overview: string | null
  poster_path: string | null
  vote_average: number | null
  vote_count: number | null
  genres: Array<{ name: string }> | null
  release_date?: string
  first_air_date?: string
}

// TMDB uses a single type — movies have `title`+`release_date`, TV has `name`+`first_air_date`
// Both are optional on the union; the provider handles the fallbacks

// ==================== Bangumi ====================

export interface BangumiSubjectApiResponse {
  name: string
  name_cn: string
  summary: string | null
  date: string | null
  images: {
    large: string
  } | null
  rating: {
    score: number | null
    total: number | null
  } | null
}

// ==================== NeoDB ====================

export interface NeoDBBookApiResponse {
  title: string
  description: string | null
  cover_image_url: string | null
  url: string | null
  isbn: string | null
  author: string | null
  rating: {
    value: number | null
  } | null
}

// ==================== LeetCode ====================

export interface LeetCodeGraphQLApiResponse {
  data: {
    question: {
      title: string
      titleSlug: string
      content: string | null
      difficulty: string
      stats: {
        totalAccepted: number
        totalSubmission: number
      } | null
      topicTags: Array<{ name: string }> | null
    } | null
  }
}

// ==================== Netease Music ====================

export interface NeteaseSongDetailApiResponse {
  songs: Array<{
    name: string
    artists: Array<{ name: string }> | null
    album: {
      name: string
      picUrl: string
    } | null
  }> | null
}
