// patch for version lower than v2.0.0-alpha.1

import { patch } from './bootstrap'

patch(async ({ models: { note, post, category } }) => {
  await Promise.all([
    [note, post].map((model) => {
      return model.updateMany(
        {},
        {
          $unset: ['options'],
        },
      )
    }),
    category.updateMany({}, { $unset: { count: '' } }),
  ])
})
