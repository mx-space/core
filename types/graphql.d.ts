/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */
export enum CategoryType {
  Category = 'Category',
  Tag = 'Tag',
}

export class Paginator {
  total: number
  size: number
  currentPage: number
  totalPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export class Image {
  width?: Nullable<number>
  height?: Nullable<number>
  accent?: Nullable<string>
  type?: Nullable<string>
  src: string
}

export class CountMixed {
  read?: Nullable<number>
  like?: Nullable<number>
}

export class CategoryModel {
  created?: Nullable<DateTime>
  name: string
  type?: Nullable<CategoryType>
  slug: string
}

export class PostModel {
  created?: Nullable<DateTime>
  commentsIndex?: Nullable<number>
  allowComment: boolean
  images?: Nullable<Image>
  title: string
  text: string
  modified: DateTime
  categoryId: string
  category?: Nullable<CategoryModel>
  count?: Nullable<CountMixed>
  slug: string
  summary?: Nullable<string>
  hide?: Nullable<boolean>
  copyright?: Nullable<boolean>
  tags?: Nullable<string[]>
}

export class PostPaginatorModel {
  data: PostModel[]
  pagination: Paginator
}

export abstract class IQuery {
  abstract sayHello(): string | Promise<string>
  abstract getPostById(id: string): PostModel | Promise<PostModel>
  abstract getPostList(
    size?: Nullable<number>,
    page?: Nullable<number>,
    select?: Nullable<string>,
    year?: Nullable<number>,
    state?: Nullable<number>,
    sortOrder?: Nullable<number>,
    sortBy?: Nullable<string>,
  ): PostPaginatorModel | Promise<PostPaginatorModel>
  abstract getByCateAndSlug(
    category: string,
    slug: string,
  ): PostModel | Promise<PostModel>
}

export type DateTime = any
type Nullable<T> = T | null
