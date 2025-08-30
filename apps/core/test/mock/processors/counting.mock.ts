import { CountingService } from '~/processors/helper/helper.counting.service'
import { defineProvider } from 'test/helper/defineProvider'

const isLikeBeforeMap = {} as Record<string, boolean>

export const countingServiceProvider = defineProvider({
  useValue: {
    async updateLikeCount(_, id) {
      const isLiked = isLikeBeforeMap[id]
      if (isLiked) {
        return false
      }
      isLikeBeforeMap[id] = true
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
