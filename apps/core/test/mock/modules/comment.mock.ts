import { dbHelper } from 'test/helper/db-mock.helper'
import { defineProvider } from 'test/helper/defineProvider'

import { CommentService } from '~/modules/comment/comment.service'
import type { CommentModel } from '~/modules/comment/comment.types'

export const commentProvider = defineProvider({
  provide: CommentService,
  useValue: {
    model: dbHelper.getModel(CommentModel) as any,
  },
})
