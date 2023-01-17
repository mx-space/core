import { defineProvider } from 'test/helper/defineProvider'

import { CountingService } from '~/processors/helper/helper.counting.service'

export const countingServiceProvider = defineProvider({
  useValue: {
    async updateLikeCount() {
      return true
    },
    async getThisRecordIsLiked() {
      return true
    },
    async updateReadCount() {
      return
    },
  },
  provide: CountingService,
})
