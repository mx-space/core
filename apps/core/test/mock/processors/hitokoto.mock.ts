import { HitokotoService } from '~/processors/helper/helper.hitokoto.service'
import { defineProvider } from 'test/helper/defineProvider'

export const hitokotoProvider = defineProvider({
  provide: HitokotoService,
  useValue: {
    async getHitokoto() {
      return {
        text: '那些看似不起波澜的日复一日，会突然在某一天让你看到坚持的意义。',
        from: '测试出处',
        author: '测试作者',
      }
    },
  },
})
