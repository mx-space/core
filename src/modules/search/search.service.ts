import algoliasearch from 'algoliasearch'

import { SearchResponse } from '@algolia/client-search'
import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common'

import { SearchDto } from '~/modules/search/search.dto'
import { DatabaseService } from '~/processors/database/database.service'
import { Pagination } from '~/shared/interface/paginator.interface'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'

import { ConfigsService } from '../configs/configs.service'
import { NoteService } from '../note/note.service'
import { PostService } from '../post/post.service'

@Injectable()
export class SearchService {
  constructor(
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,

    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,

    private readonly configs: ConfigsService,
    private readonly databaseService: DatabaseService,
  ) {}

  async searchNote(searchOption: SearchDto, showHidden: boolean) {
    const { keyword, page, size } = searchOption
    const select = '_id title created modified nid'

    const keywordArr = keyword
      .split(/\s+/)
      .map((item) => new RegExp(String(item), 'ig'))

    return transformDataToPaginate(
      await this.noteService.model.paginate(
        {
          $or: [{ title: { $in: keywordArr } }, { text: { $in: keywordArr } }],
          $and: [
            { password: { $in: [undefined, null] } },
            { hide: { $in: showHidden ? [false, true] : [false] } },
            {
              $or: [
                { secret: { $in: [undefined, null] } },
                { secret: { $lte: new Date() } },
              ],
            },
          ],
        },
        {
          limit: size,
          page,
          select,
        },
      ),
    )
  }

  async searchPost(searchOption: SearchDto) {
    const { keyword, page, size } = searchOption
    const select = '_id title created modified categoryId slug'
    const keywordArr = keyword
      .split(/\s+/)
      .map((item) => new RegExp(String(item), 'ig'))
    return transformDataToPaginate(
      await this.postService.findWithPaginator(
        {
          $or: [{ title: { $in: keywordArr } }, { text: { $in: keywordArr } }],
        },
        {
          limit: size,
          page,
          select,
        },
      ),
    )
  }

  public async getAlgoliaSearchIndex() {
    const { algoliaSearchOptions } = await this.configs.waitForConfigReady()
    if (!algoliaSearchOptions.enable) {
      throw new BadRequestException('algolia not enable.')
    }
    if (
      !algoliaSearchOptions.appId ||
      !algoliaSearchOptions.apiKey ||
      !algoliaSearchOptions.indexName
    ) {
      throw new BadRequestException('algolia not config.')
    }
    const client = algoliasearch(
      algoliaSearchOptions.appId,
      algoliaSearchOptions.apiKey,
    )
    const index = client.initIndex(algoliaSearchOptions.indexName)
    return index
  }

  async searchAlgolia(searchOption: SearchDto): Promise<
    | SearchResponse<{
        id: string
        text: string
        title: string
        type: 'post' | 'note' | 'page'
      }>
    | (Pagination<any> & {
        raw: SearchResponse<{
          id: string
          text: string
          title: string
          type: 'post' | 'note' | 'page'
        }>
      })
  > {
    const { keyword, size, page } = searchOption
    const index = await this.getAlgoliaSearchIndex()

    const search = await index.search<{
      id: string
      text: string
      title: string
      type: 'post' | 'note' | 'page'
    }>(keyword, {
      // start with 0
      page: page - 1,
      hitsPerPage: size,
      attributesToRetrieve: ['*'],
      snippetEllipsisText: '...',
      responseFields: ['*'],
      facets: ['*'],
    })
    if (searchOption.rawAlgolia) {
      return search
    }
    const data: any[] = []
    const tasks = search.hits.map((hit) => {
      const { type, objectID } = hit

      const model = this.databaseService.getModelByRefType(type as any)
      if (!model) {
        return
      }
      return model
        .findById(objectID)
        .select('_id title created modified categoryId slug nid')
        .lean()
        .then((doc) => {
          if (doc) {
            Reflect.set(doc, 'type', type)
            data.push(doc)
          }
        })
    })
    await Promise.all(tasks)
    return {
      data,
      raw: search,
      pagination: {
        currentPage: page,
        total: search.nbHits,
        hasNextPage: search.nbPages > search.page,
        hasPrevPage: search.page > 1,
        size: search.hitsPerPage,
        totalPage: search.nbPages,
      },
    }
  }
}
