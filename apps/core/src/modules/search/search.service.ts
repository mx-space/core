import algoliasearch from 'algoliasearch'
import type { SearchResponse } from '@algolia/client-search'
import type { SearchDto } from '~/modules/search/search.dto'
import type { Pagination } from '~/shared/interface/paginator.interface'

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { CronExpression } from '@nestjs/schedule'

import { CronDescription } from '~/common/decorators/cron-description.decorator'
import { CronOnce } from '~/common/decorators/cron-once.decorator'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'

import { ConfigsService } from '../configs/configs.service'
import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostService } from '../post/post.service'

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)
  constructor(
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,

    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,

    @Inject(forwardRef(() => PageService))
    private readonly pageService: PageService,

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
            { password: { $not: null } },
            { hide: { $in: showHidden ? [false, true] : [false] } },
            {
              $or: [
                { secret: { $not: null } },
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
    return await this.postService.model.paginate(
      {
        $or: [{ title: { $in: keywordArr } }, { text: { $in: keywordArr } }],
      },
      {
        limit: size,
        page,
        select,
      },
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
        .lean({
          getters: true,
          autopopulate: true,
        })
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

  /**
   * @description 每天凌晨推送一遍 Algolia Search
   */
  @CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'pushToAlgoliaSearch',
  })
  @CronDescription('推送到 Algolia Search')
  @OnEvent(EventBusEvents.PushSearch)
  async pushToAlgoliaSearch() {
    const configs = await this.configs.waitForConfigReady()
    if (!configs.algoliaSearchOptions.enable || isDev) {
      return
    }
    const index = await this.getAlgoliaSearchIndex()

    this.logger.log('--> 开始推送到 Algolia')
    const documents: Record<'title' | 'text' | 'type' | 'id', string>[] = []
    const combineDocuments = await Promise.all([
      this.postService.model
        .find({ hide: false })
        .select('title text categoryId category')
        .populate('category', 'name slug')
        .lean()

        .then((list) => {
          return list.map((data) => {
            Reflect.set(data, 'objectID', data._id)
            Reflect.deleteProperty(data, '_id')
            return {
              ...data,
              type: 'post',
            }
          })
        }),
      this.pageService.model
        .find({}, 'title text')
        .lean()
        .then((list) => {
          return list.map((data) => {
            Reflect.set(data, 'objectID', data._id)
            Reflect.deleteProperty(data, '_id')
            return {
              ...data,
              type: 'page',
            }
          })
        }),
      this.noteService.model
        .find(
          {
            hide: false,
            $or: [
              { password: undefined },
              { password: null },
              { password: { $exists: false } },
            ],
          },
          'title text nid',
        )
        .lean()
        .then((list) => {
          return list.map((data) => {
            const id = data.nid.toString()
            Reflect.set(data, 'objectID', data._id)
            Reflect.deleteProperty(data, '_id')
            Reflect.deleteProperty(data, 'nid')
            return {
              ...data,
              type: 'note',
              id,
            }
          })
        }),
    ])
    combineDocuments.forEach((documents_: any) => {
      documents.push(...documents_)
    })
    try {
      await index.clearObjects()
      await Promise.all([
        index.saveObjects(documents, {
          autoGenerateObjectIDIfNotExist: false,
        }),
        index.setSettings({
          attributesToHighlight: ['text', 'title'],
        }),
      ])

      this.logger.log('--> 推送到 algoliasearch 成功')
    } catch (err) {
      Logger.error('algolia 推送错误', 'AlgoliaSearch')
      throw err
    }
  }
}
