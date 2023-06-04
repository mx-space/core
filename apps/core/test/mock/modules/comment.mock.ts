import { dbHelper } from 'test/helper/db-mock.helper'
import { defineProvider } from 'test/helper/defineProvider'

import { CommentModel } from '~/modules/comment/comment.model'
import { CommentService } from '~/modules/comment/comment.service'

export const commentProvider = defineProvider({
  provide: CommentService,
  useValue: {
    model: dbHelper.getModel(CommentModel) as any,
  },
})
