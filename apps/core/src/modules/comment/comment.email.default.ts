import dayjs from 'dayjs'
import type { UserModel, UserModelSecurityKeys } from '../user/user.model'
import type { CommentModel } from './comment.model'

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
  text: '世界！' as string,
  ip: '0.0.0.0' as string | undefined,
  agent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' as string,
  created: new Date().toISOString(),
  isWhispers: false,
  location: '' as string | undefined,
  url: 'https://blog.commentor.com' as string,
}

export const defaultCommentModelKeys = [
  ...Object.keys(defaultCommentModelForRenderProps),
]

const defaultPostModelForRenderProps = {
  title: '匆匆',
  id: 'd7e0ed429da8ae90988c37da',
  text: '燕子去了，有再来的时候；杨柳枯了，有再青的时候；桃花谢了，有再开的时候。但是，聪明的，你告诉我，我们的日子为什么一去不复返呢？——是有人偷了他们罢：那是谁？又藏在何处呢？是他们自己逃走了罢：如今（现在 [2] ）又到了哪里呢？',
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
  master: 'innei' as string,

  aggregate: {
    post: defaultPostModelForRenderProps,
    commentor: defaultCommentModelForRenderProps,
    parent: null as CommentModel | null,
    owner: {} as Omit<UserModel, UserModelSecurityKeys>,
  },
})
type Writeable<T> = { -readonly [P in keyof T]: T[P] }

export type CommentEmailTemplateRenderProps = Writeable<typeof baseRenderProps>
