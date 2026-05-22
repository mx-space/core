import { z } from 'zod'

const SearchResultSchema = z.object({}).passthrough()

export const SearchViews = {
  result: SearchResultSchema,
} as const

export type SearchView = keyof typeof SearchViews
