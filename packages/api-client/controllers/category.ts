import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type {
  IRequestHandler,
  RequestProxyResult,
  ResponseProxyExtraRaw,
} from '~/interfaces/request'
import { attachRawFromOneToAnthor, destructureData } from '~/utils'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core/client'
import { RequestError } from '../core/error'
import type {
  CategoryEntries,
  CategoryModel,
  CategoryWithChildrenModel,
  TagModel,
} from '../models/category'
import { CategoryType } from '../models/category'
import type { PostModel } from '../models/post'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    category: CategoryController<ResponseWrapper>
  }
}

export class CategoryController<ResponseWrapper> implements IController {
  name = 'category'
  base = 'categories'
  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  getAllCategories(): RequestProxyResult<
    { data: CategoryModel[] },
    ResponseWrapper
  > {
    return this.proxy.get({
      params: {
        type: CategoryType.Category,
      },
    })
  }

  getAllTags(): RequestProxyResult<{ data: TagModel[] }, ResponseWrapper> {
    return this.proxy.get<{ data: TagModel[] }>({
      params: {
        type: CategoryType.Tag,
      },
    })
  }

  async getCategoryDetail(
    id: string,
  ): Promise<ResponseProxyExtraRaw<CategoryWithChildrenModel>>
  async getCategoryDetail(
    ids: string[],
  ): Promise<ResponseProxyExtraRaw<Map<string, CategoryWithChildrenModel>>>
  async getCategoryDetail(ids: string | string[]): Promise<any> {
    if (typeof ids === 'string') {
      const data = await this.proxy.get<CategoryEntries>({
        params: {
          ids,
        },
      })
      const result = Object.values(data.entries)[0]
      attachRawFromOneToAnthor(data, result)
      return result
    } else if (Array.isArray(ids)) {
      const data = await this.proxy.get<CategoryEntries>({
        params: {
          ids: ids.join(','),
        },
      })
      const entries = data?.entries
      if (!entries) {
        throw new RequestError(
          'data structure error',
          500,
          data.$request.path,
          data,
        )
      }

      const map = new Map<string, CategoryWithChildrenModel>(
        Object.entries(entries).map(([id, value]) => [id.toLowerCase(), value]),
      )

      attachRawFromOneToAnthor(data, map)
      return map
    }
  }

  async getCategoryByIdOrSlug(idOrSlug: string) {
    const res = await this.proxy(idOrSlug).get<CategoryWithChildrenModel>()
    return destructureData(res) as typeof res
  }

  async getTagByName(name: string) {
    const res = await this.proxy(name).get<{
      tag: string
      data: Pick<PostModel, 'id' | 'title' | 'slug' | 'category' | 'created'>[]
    }>({
      params: {
        tag: 1,
      },
    })

    return res
  }
}
