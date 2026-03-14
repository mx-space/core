import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { zMongoId } from '~/common/zod'

export enum RecentlyAttitudeEnum {
  Up,
  Down,
}

export enum RecentlyTypeEnum {
  Text = 'text',
  Book = 'book',
  Media = 'media',
  Music = 'music',
  Github = 'github',
  Link = 'link',
  Academic = 'academic',
  Code = 'code',
}

// --- Metadata schemas per type ---

export const BookMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  author: z.string(),
  cover: z.string().url().optional(),
  rating: z.number().min(0).max(10).optional(),
  isbn: z.string().optional(),
})

export const MediaMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  originalTitle: z.string().optional(),
  cover: z.string().url().optional(),
  rating: z.number().min(0).max(10).optional(),
  description: z.string().optional(),
  genre: z.string().optional(),
})

export const MusicMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  cover: z.string().url().optional(),
  source: z.string().optional(),
})

export const GithubMetaSchema = z.object({
  url: z.string().url(),
  owner: z.string(),
  repo: z.string(),
  description: z.string().optional(),
  stars: z.number().optional(),
  language: z.string().optional(),
  languageColor: z.string().optional(),
})

export const LinkMetaSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().url().optional(),
})

export const AcademicMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  authors: z.array(z.string()).optional(),
  arxivId: z.string().optional(),
})

export const CodeMetaSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
  platform: z.string().optional(),
})

// --- Shared optional fields ---

const refFields = {
  ref: zMongoId.optional(),
  refType: z.string().optional(),
}

// --- Discriminated union with preprocess for backward compat ---

const RecentlyDiscriminatedSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(RecentlyTypeEnum.Text),
    content: z.string().min(1),
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Book),
    content: z.string().optional().default(''),
    metadata: BookMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Media),
    content: z.string().optional().default(''),
    metadata: MediaMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Music),
    content: z.string().optional().default(''),
    metadata: MusicMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Github),
    content: z.string().optional().default(''),
    metadata: GithubMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Link),
    content: z.string().optional().default(''),
    metadata: LinkMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Academic),
    content: z.string().optional().default(''),
    metadata: AcademicMetaSchema,
    ...refFields,
  }),
  z.object({
    type: z.literal(RecentlyTypeEnum.Code),
    content: z.string().optional().default(''),
    metadata: CodeMetaSchema,
    ...refFields,
  }),
])

export const RecentlySchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object' && !('type' in val)) {
    return { ...val, type: RecentlyTypeEnum.Text }
  }
  return val
}, RecentlyDiscriminatedSchema)

// z.preprocess returns ZodEffects which is incompatible with createZodDto's type constraint,
// but runtime behavior is correct. Use type assertion to bypass.
export class RecentlyDto extends createZodDto(
  RecentlySchema as unknown as z.ZodObject<any>,
) {}

// --- Attitude schema (unchanged) ---

export const RecentlyAttitudeSchema = z.object({
  attitude: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.enum(RecentlyAttitudeEnum),
  ),
})

export class RecentlyAttitudeDto extends createZodDto(RecentlyAttitudeSchema) {}

// Type exports
export type RecentlyInput = z.infer<typeof RecentlyDiscriminatedSchema>
export type RecentlyAttitudeInput = z.infer<typeof RecentlyAttitudeSchema>
