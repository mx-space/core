import { z } from 'zod'

const AggregateDetailSchema = z.object({}).passthrough()

const DeskSchema = z
  .object({
    unreadComments: z.object({
      count: z.number().int(),
      latest: z
        .object({
          id: z.string(),
          author: z.string(),
          text: z.string(),
          refTitle: z.string().nullable(),
        })
        .nullable(),
    }),
    linkApplications: z.object({
      count: z.number().int(),
      latest: z
        .object({
          id: z.string(),
          name: z.string(),
          url: z.string(),
        })
        .nullable(),
    }),
    scheduledNotes: z.array(
      z.object({
        id: z.string(),
        nid: z.number().int(),
        title: z.string().nullable(),
        publicAt: z.string(),
      }),
    ),
  })
  .passthrough()

const StatSchema = z
  .object({
    posts: z.number().int(),
    notes: z.number().int(),
    pages: z.number().int(),
    says: z.number().int(),
    comments: z.number().int(),
    allComments: z.number().int(),
    unreadComments: z.number().int(),
    links: z.number().int(),
    linkApply: z.number().int(),
    categories: z.number().int(),
    recently: z.number().int(),
    online: z.number().int(),
    todayMaxOnline: z.string(),
    todayOnlineTotal: z.string(),
    callTime: z.number().int(),
    uv: z.number().int(),
    todayIpAccessCount: z.number().int(),
  })
  .passthrough()

export const AggregateViews = {
  detail: AggregateDetailSchema,
  desk: DeskSchema,
  stat: StatSchema,
} as const

export type AggregateView = keyof typeof AggregateViews
