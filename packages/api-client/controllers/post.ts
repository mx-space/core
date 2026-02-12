import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { SelectFields } from '~/interfaces/types'
import type {
  ModelWithLiked,
  ModelWithTranslation,
  PaginateResult,
  TranslationMeta,
} from '~/models/base'
import type { PostModel } from '~/models/post'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core/client'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    post: PostController<ResponseWrapper>
  }
}

export type PostListOptions = {
  select?: SelectFields<keyof PostModel>
  year?: number
  sortBy?: 'categoryId' | 'title' | 'created' | 'modified'
  sortOrder?: 1 | -1
  truncate?: number
  /** 语言代码，用于获取翻译版本 */
  lang?: string
}

/** 文章列表项，可能包含翻译信息 */
export type PostListItem = PostModel & {
  isTranslated?: boolean
  translationMeta?: TranslationMeta
}

export class PostController<ResponseWrapper> implements IController {
  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  base = 'posts'

  name = 'post'

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  /**
   * 获取文章列表分页
   * @param page
   * @param perPage
   * @param options 可选参数，包含 lang 用于获取翻译版本
   * @returns 当传入 lang 时，返回的文章可能包含 isTranslated 和 translationMeta 字段
   */
  getList(page = 1, perPage = 10, options: PostListOptions = {}) {
    const { select, sortBy, sortOrder, year, truncate, lang } = options
    return this.proxy.get<PaginateResult<PostListItem>>({
      params: {
        page,
        size: perPage,
        select: select?.join(' '),
        sortBy,
        sortOrder,
        year,
        truncate,
        lang,
      },
    })
  }

  /**
   * 根据分类和路径查找文章
   * @param categoryName
   * @param slug
   * @param options 可选参数，包含 lang 用于获取翻译版本
   */
  getPost(
    categoryName: string,
    slug: string,
    options?: { lang?: string },
  ): RequestProxyResult<
    ModelWithLiked<ModelWithTranslation<PostModel>>,
    ResponseWrapper
  >
  /**
   * 根据 ID 查找文章
   * @param id
   */
  getPost(id: string): RequestProxyResult<PostModel, ResponseWrapper>
  getPost(
    idOrCategoryName: string,
    slug?: string,
    options?: { lang?: string },
  ): any {
    if (arguments.length == 1) {
      return this.proxy(idOrCategoryName).get<PostModel>()
    } else {
      return this.proxy(idOrCategoryName)(slug).get<PostModel>({
        params: options?.lang ? { lang: options.lang } : undefined,
      })
    }
  }

  /**
   * 获取最新的文章
   */
  getLatest() {
    return this.proxy.latest.get<ModelWithLiked<PostModel>>()
  }

  getFullUrl(slug: string) {
    return this.proxy('get-url')(slug).get<{ path: string }>()
  }
}
