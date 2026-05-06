/**
 * Type-safe API response interfaces for enrichment providers.
 * GitHub types removed — use Octokit SDK types directly via `octokit.rest.*`.
 */

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
