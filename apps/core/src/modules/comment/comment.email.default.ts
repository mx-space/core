import dayjs from 'dayjs'

import type { OwnerModel, OwnerModelSecurityKeys } from '../owner/owner.types'
import type { CommentModel } from './comment.types'

export interface CommentModelRenderProps {
  author: string
  avatar: string
  mail: string
  text: string
  ip?: string | undefined
  agent: string
  created: string
  isWhispers: boolean
  location?: string | undefined
  url: string
}
const defaultCommentModelForRenderProps: CommentModelRenderProps = {
  author: 'Commentor' as string,
  avatar:
    'https://cloudflare-ipfs.com/ipfs/Qmd3W5DuhgHirLHGVixi6V76LhCkZUz6pnFt5AJBiyvHye/avatar/976.jpg' as string,
  mail: 'commtor@example.com' as string,
  text: 'Hello world!' as string,
  ip: '0.0.0.0' as string | undefined,
  agent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' as string,
  created: new Date().toISOString(),
  isWhispers: false,
  location: '' as string | undefined,
  url: 'https://blog.commentor.com' as string,
}

export const defaultCommentModelKeys = Object.keys(
  defaultCommentModelForRenderProps,
)

const defaultPostModelForRenderProps = {
  title: 'Sample Post',
  id: 'd7e0ed429da8ae90988c37da',
  text: 'Swallows may have gone, but there is a time of return; willow trees may have died back, but there is a time of regreening; peach blossoms may have fallen, but they will bloom again. But, tell me, you the wise, why should our days leave us, never to return?',
  created: new Date().toISOString(),
  modified: null as string | null,
}

export const baseRenderProps = Object.freeze({
  author: defaultCommentModelForRenderProps.author,
  mail: defaultCommentModelForRenderProps.mail,
  text: defaultCommentModelForRenderProps.text,
  ip: defaultCommentModelForRenderProps.ip,
  link: 'https://innei.in/note/122#comments-37ccbeec9c15bb0ddc51ca7d' as string,

  time: dayjs().format('YYYY/MM/DD'),
  title: defaultPostModelForRenderProps.title,
  owner: 'innei' as string,

  aggregate: {
    post: defaultPostModelForRenderProps,
    commentor: defaultCommentModelForRenderProps,
    parent: null as CommentModel | null,
    owner: {} as Omit<OwnerModel, OwnerModelSecurityKeys>,
  },
})
type Writeable<T> = { -readonly [P in keyof T]: T[P] }

export type CommentEmailTemplateRenderProps = Writeable<typeof baseRenderProps>
