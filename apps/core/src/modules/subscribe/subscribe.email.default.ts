import type { UserModel, UserModelSecurityKeys } from '../user/user.model'
import { SubscribeAllBit } from './subscribe.constant'

const defaultPostProps = {
  text: '年纪在四十以上，二十以下的，恐怕就不易在前两派里有个地位了。他们的车破，又不敢“拉晚儿”，所以只能早早的出车，希望能从清晨转到午后三四点钟，拉出“车份儿”和自己的嚼谷①。他们的车破，跑得慢，所以得多走路，少要钱。到瓜市，果市，菜市，去拉货物，都是他们；钱少，可是无须快跑呢。',
  title: '骆驼祥子',
}

export const defaultSubscribeForRenderProps = {
  ...defaultPostProps,

  author: '',
  detail_link: '#detail_link',
  unsubscribe_link: '#unsubscribe_link',
  master: '',

  aggregate: {
    owner: {} as Omit<UserModel, UserModelSecurityKeys>,
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
