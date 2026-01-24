import type { SearchClient, SearchResponse } from '@algolia/client-search'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { CronExpression } from '@nestjs/schedule'
import { CronDescription } from '~/common/decorators/cron-description.decorator'
import { CronOnce } from '~/common/decorators/cron-once.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import type { SearchDto } from '~/modules/search/search.schema'
import { DatabaseService } from '~/processors/database/database.service'
import type { Pagination } from '~/shared/interface/paginator.interface'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { algoliasearch } from 'algoliasearch'
import { omit } from 'es-toolkit/compat'
import removeMdCodeblock from 'remove-md-codeblock'
import { ConfigsService } from '../configs/configs.service'
import { NoteModel } from '../note/note.model'
import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostModel } from '../post/post.model'
import type { PostService } from '../post/post.service'

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)
  constructor(
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,

    @Inject(POST_SERVICE_TOKEN)
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
      .map((item) => new RegExp(String(item), 'gi'))

    return transformDataToPaginate(
      await this.noteService.model.paginate(
        {
          $or: [{ title: { $in: keywordArr } }, { text: { $in: keywordArr } }],
          $and: [
            { password: { $not: null } },
            { isPublished: { $in: showHidden ? [false, true] : [true] } },
            {
              $or: [
                { publicAt: { $not: null } },
                { publicAt: { $lte: new Date() } },
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
      .map((item) => new RegExp(String(item), 'gi'))
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

  public async getAlgoliaSearchClient() {
    const { algoliaSearchOptions } = await this.configs.waitForConfigReady()
    if (!algoliaSearchOptions.enable) {
      throw new BizException(ErrorCodeEnum.AlgoliaNotEnabled)
    }
    if (
      !algoliaSearchOptions.appId ||
      !algoliaSearchOptions.apiKey ||
      !algoliaSearchOptions.indexName
    ) {
      throw new BizException(ErrorCodeEnum.AlgoliaNotConfigured)
    }
    const client = algoliasearch(
      algoliaSearchOptions.appId,
      algoliaSearchOptions.apiKey,
    )
    return { client, indexName: algoliaSearchOptions.indexName }
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
    const { client, indexName } = await this.getAlgoliaSearchClient()

    const search = await client.searchSingleIndex<{
      id: string
      text: string
      title: string
      type: 'post' | 'note' | 'page'
    }>({
      indexName,
      searchParams: {
        query: keyword,
        page: page - 1,
        hitsPerPage: size,
        attributesToRetrieve: ['*'],
        snippetEllipsisText: '...',
        facets: ['*'],
      },
    })
    if (searchOption.rawAlgolia) {
      return search
    }
    const data: any[] = []
    const tasks = search.hits.map(async (hit) => {
      const { type, objectID } = hit

      const model = this.databaseService.getModelByRefType(type as 'post')
      if (!model) {
        return
      }
      const doc = await model
        .findById(objectID)
        .select('_id title created modified categoryId slug nid')
        .lean({
          getters: true,
          autopopulate: true,
        })
      if (doc) {
        Reflect.set(doc, 'type', type)
        data.push(doc)
      }
    })
    await Promise.all(tasks)
    return {
      data,
      raw: search,
      pagination: {
        currentPage: page,
        total: search.nbHits ?? 0,
        hasNextPage: (search.nbPages ?? 0) > (search.page ?? 0),
        hasPrevPage: (search.page ?? 0) > 1,
        size: search.hitsPerPage ?? size,
        totalPage: search.nbPages ?? 0,
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
  async pushAllToAlgoliaSearch() {
    const configs = await this.configs.waitForConfigReady()
    if (!configs.algoliaSearchOptions.enable || isDev) {
      return
    }
    const { client, indexName } = await this.getAlgoliaSearchClient()

    this.logger.log('--> 开始推送到 Algolia')

    const documents = await this.buildAlgoliaIndexData()
    try {
      await Promise.all([
        client.replaceAllObjects({
          indexName,
          objects: documents,
        }),
        client.setSettings({
          indexName,
          indexSettings: {
            attributesToHighlight: ['text', 'title'],
          },
        }),
      ])

      this.logger.log('--> 推送到 algoliasearch 成功')
    } catch (error) {
      Logger.error('algolia 推送错误', 'AlgoliaSearch')
      throw error
    }
  }

  async buildAlgoliaIndexData() {
    const combineDocuments = await Promise.all([
      this.postService.model
        .find()
        .select('title text categoryId category slug')
        .populate('category', 'name slug')
        .lean()

        .then((list) => {
          return list.map((data) => {
            Reflect.set(data, 'objectID', data._id)
            Reflect.deleteProperty(data, '_id')
            return {
              ...data,
              text: removeMdCodeblock(data.text),
              type: 'post',
            }
          })
        }),
      this.pageService.model
        .find({}, 'title text slug subtitle')
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
            isPublished: true,
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

    const { algoliaSearchOptions } = await this.configs.waitForConfigReady()

    return combineDocuments
      .flat()
      .map((item) =>
        adjustObjectSizeEfficiently(item, algoliaSearchOptions.maxTruncateSize),
      )
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.POST_UPDATE)
  async onPostCreate(post: PostModel) {
    const data = await this.postService.model.findById(post.id).lean()

    if (!data) return

    this.executeAlgoliaSearchOperationIfEnabled(
      async ({ client, indexName }) => {
        const { algoliaSearchOptions } = await this.configs.waitForConfigReady()

        this.logger.log(
          `detect post created or update, save to algolia, data id:${data.id}`,
        )
        await client.saveObject({
          indexName,
          body: adjustObjectSizeEfficiently(
            {
              ...omit(data, '_id'),
              objectID: data.id,
              id: data.id,
              type: 'post',
            },
            algoliaSearchOptions.maxTruncateSize,
          ),
        })
        this.logger.log(`save to algolia success, id: ${data.id}`)
      },
    )
  }

  @OnEvent(BusinessEvents.NOTE_CREATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async onNoteCreate(note: NoteModel) {
    const data = await this.noteService.model.findById(note.id).lean()

    if (!data) return

    this.executeAlgoliaSearchOperationIfEnabled(
      async ({ client, indexName }) => {
        this.logger.log(
          `detect post created or update, save to algolia, data id:${data.id}`,
        )
        const { algoliaSearchOptions } = await this.configs.waitForConfigReady()

        await client.saveObject({
          indexName,
          body: adjustObjectSizeEfficiently(
            {
              ...omit(data, '_id'),
              objectID: data.id,
              id: data.id,
              type: 'note',
            },
            algoliaSearchOptions.maxTruncateSize,
          ),
        })
        this.logger.log(`save to algolia success, id: ${data.id}`)
      },
    )
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  async onPostDelete({ data: id }: { data: string }) {
    await this.executeAlgoliaSearchOperationIfEnabled(
      async ({ client, indexName }) => {
        this.logger.log(`detect data delete, save to algolia, data id: ${id}`)

        await client.deleteObject({ indexName, objectID: id })
      },
    )
  }

  private async executeAlgoliaSearchOperationIfEnabled(
    caller: (ctx: { client: SearchClient; indexName: string }) => Promise<any>,
  ) {
    const configs = await this.configs.waitForConfigReady()
    if (!configs.algoliaSearchOptions.enable || isDev) {
      return
    }
    const { client, indexName } = await this.getAlgoliaSearchClient()
    return caller({ client, indexName })
  }
}

const MAX_SIZE_IN_BYTES = 10_000
function adjustObjectSizeEfficiently<T extends { text: string }>(
  originalObject: T,
  maxSizeInBytes: number = MAX_SIZE_IN_BYTES,
): any {
  // 克隆原始对象以避免修改引用
  const objectToAdjust = JSON.parse(JSON.stringify(originalObject))
  const text = objectToAdjust.text

  let low = 0
  let high = text.length
  let mid = 0

  while (low <= high) {
    mid = Math.floor((low + high) / 2)
    objectToAdjust.text = text.slice(0, mid)
    const currentSize = new TextEncoder().encode(
      JSON.stringify(objectToAdjust),
    ).length

    if (currentSize > maxSizeInBytes) {
      // 如果当前大小超过限制，减少 text 长度
      high = mid - 1
    } else if (currentSize < maxSizeInBytes) {
      // 如果当前大小未达限制，尝试增加text长度
      low = mid + 1
    } else {
      // 精确匹配，退出循环
      break
    }
  }

  // 微调，确保不超过最大大小
  while (
    new TextEncoder().encode(JSON.stringify(objectToAdjust)).length >
    maxSizeInBytes
  ) {
    objectToAdjust.text = objectToAdjust.text.slice(0, -1)
  }

  // 返回调整后的对象
  return objectToAdjust as T
}
