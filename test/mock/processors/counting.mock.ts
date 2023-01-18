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
    updateReadCount: vi.fn().mockImplementation(async () => {
      return
    }),
  },
  provide: CountingService,
})
