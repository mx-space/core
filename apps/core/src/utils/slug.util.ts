import slugify from 'slugify'

export const normalizeSlug = (slug?: string | null): string | undefined => {
  if (!slug) return undefined
  const normalized = slugify(slug, { lower: true, strict: true, trim: true })
  return normalized || undefined
}
