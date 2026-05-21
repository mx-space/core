import type { OwnerModel, OwnerModelSecurityKeys } from '../owner/owner.types'
import { SubscribeAllBit } from './subscribe.constant'

const defaultPostProps = {
  text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness, it was the spring of hope, it was the winter of despair.',
  title: 'A Tale of Two Cities',
}

export const defaultSubscribeForRenderProps = {
  ...defaultPostProps,

  author: '',
  detail_link: '#detail_link',
  unsubscribe_link: '#unsubscribe_link',
  owner: '',

  aggregate: {
    owner: {} as Omit<OwnerModel, OwnerModelSecurityKeys>,
    subscriber: {
      email: 'subscriber@mail.com',
      subscribe: SubscribeAllBit,
    },
    post: {
      ...defaultPostProps,
      id: 'cdab54a19f3f03f7f5159df7',
      created: '2023-06-04T15:02:09.179Z',
    },
  },
}

export type SubscribeTemplateRenderProps = typeof defaultSubscribeForRenderProps
