import type { SearchResponse } from '@algolia/client-search'
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common'
import algoliasearch from 'algoliasearch'
import { SearchDto } from '~/modules/search/search.dto'
import { DatabaseService } from '~/processors/database/database.service'
import { Pagination } from '~/shared/interface/paginator.interface'
import { addConditionToSeeHideContent } from '~/utils/query.util'
import { transformDataToPaginate } from '~/utils/transfrom.util'
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

  async searchPost(searchOption: SearchDto, showHidden: boolean) {
    const { keyword, page, size } = searchOption
    const select = '_id title created modified categoryId slug'
    const keywordArr = keyword
      .split(/\s+/)
      .map((item) => new RegExp(String(item), 'ig'))
    return transformDataToPaginate(
      await this.postService.findWithPaginator(
        {
          $or: [{ title: { $in: keywordArr } }, { text: { $in: keywordArr } }],
          $and: [{ ...addConditionToSeeHideContent(showHidden) }],
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
      page: page,
      hitsPerPage: size,
    })
    if (searchOption.rawAlgolia) {
      return search
    }
    const data = []
    const tasks = search.hits.map((hit) => {
      const { type, objectID } = hit

      const model = this.databaseService.getModelByRefType(type as any)
      if (!model) {
        return
      }
      return model
        .findById(objectID)
        .select('_id title created modified categoryId slug nid')
        .populate('category')
        .lean()
        .then((doc) => {
          Reflect.set(doc, 'type', type)
          doc && data.push(doc)
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
