import type { CategoryModel } from '~/modules/category/category.model'
import type { PostModel } from '~/modules/post/post.model'

// @ts-expect-error
export default Array.from({ length: 20 }).map((_, _i) => {
  const i = _i + 1
  return {
    title: `Post ${i}`,
    text: `Content ${i}`,
    created: new Date(`2021-03-${i.toFixed().padStart(2, '0')}T00:00:00.000Z`),
    modified: null,
    allowComment: true,
    slug: `post-${i}`,
    categoryId: '5d367eceaceeed0cabcee4b1',

    commentsIndex: 0,
  }
}) as PostModel[]

export const categoryModels = [
  {
    _id: '5d367eceaceeed0cabcee4b1',
    id: '5d367eceaceeed0cabcee4b1',
    name: 'Category 1',
    slug: 'category-1',
  },
] as (CategoryModel & { _id: string })[]
