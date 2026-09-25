import { z } from 'zod'

const SearchResultSchema = z.object({}).loose()

export const SearchViews = {
  result: SearchResultSchema,
} as const

export type SearchView = keyof typeof SearchViews
