import type { CategoryModel } from '~/modules/category/category.model'
import type { PostModel } from '~/modules/post/post.model'

// @ts-expect-error
const publishedPosts = Array.from({ length: 15 }).map((_, _i) => {
  const i = _i + 1
  return {
    title: `Post ${i}`,
    text: `Content ${i}`,
    created: new Date(`2021-03-${i.toFixed().padStart(2, '0')}T00:00:00.000Z`),
    modified: null,
    allowComment: true,
    slug: `post-${i}`,
    categoryId: '5d367eceaceeed0cabcee4b1',
    isPublished: true,

    commentsIndex: 0,
  }
}) as PostModel[]

// @ts-expect-error
// 未发布的文章
const unpublishedPosts = Array.from({ length: 5 }).map((_, _i) => {
  const i = _i + 16
  return {
    title: `Unpublished Post ${i}`,
    text: `Unpublished Content ${i}`,
    created: new Date(
      `2021-04-${(_i + 1).toFixed().padStart(2, '0')}T00:00:00.000Z`,
    ),
    modified: null,
    allowComment: true,
    slug: `unpublished-post-${i}`,
    categoryId: '5d367eceaceeed0cabcee4b1',
    isPublished: false,

    commentsIndex: 0,
  }
}) as PostModel[]

// @ts-expect-error
// 第二个分类的文章
const category2Posts = Array.from({ length: 5 }).map((_, _i) => {
  const i = _i + 21
  return {
    title: `Category2 Post ${i}`,
    text: `Category2 Content ${i}`,
    created: new Date(
      `2021-05-${(_i + 1).toFixed().padStart(2, '0')}T00:00:00.000Z`,
    ),
    modified: null,
    allowComment: true,
    slug: `category2-post-${i}`,
    categoryId: '5d367eceaceeed0cabcee4b2',
    isPublished: true,

    commentsIndex: 0,
  }
}) as PostModel[]

// @ts-expect-error
// 2022年的文章 (用于年份筛选测试)
const year2022Posts = Array.from({ length: 3 }).map((_, _i) => {
  const i = _i + 26
  return {
    title: `Year 2022 Post ${i}`,
    text: `Year 2022 Content ${i}`,
    created: new Date(
      `2022-01-${(_i + 1).toFixed().padStart(2, '0')}T00:00:00.000Z`,
    ),
    modified: null,
    allowComment: true,
    slug: `year-2022-post-${i}`,
    categoryId: '5d367eceaceeed0cabcee4b1',
    isPublished: true,

    commentsIndex: 0,
  }
}) as PostModel[]

export default [
  ...publishedPosts,
  ...unpublishedPosts,
  ...category2Posts,
  ...year2022Posts,
] as PostModel[]

export const categoryModels = [
  {
    _id: '5d367eceaceeed0cabcee4b1',
    id: '5d367eceaceeed0cabcee4b1',
    name: 'Category 1',
    slug: 'category-1',
  },
  {
    _id: '5d367eceaceeed0cabcee4b2',
    id: '5d367eceaceeed0cabcee4b2',
    name: 'Category 2',
    slug: 'category-2',
  },
] as (CategoryModel & { _id: string })[]

export const testPostData = {
  published: publishedPosts,
  unpublished: unpublishedPosts,
  category2: category2Posts,
  year2022: year2022Posts,
}
