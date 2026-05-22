import { Get, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import {
  SearchAdminListDto,
  SearchDto,
  SearchRebuildQueryDto,
  SearchRebuildRefParamDto,
} from '~/modules/search/search.schema'
import {
  applyTranslationEntriesInPlace,
  type EntryMaps,
  type EntryRule,
} from '~/processors/helper/helper.translation.service'

import { SearchService } from './search.service'

const CATEGORY_NAME_RULES: ReadonlyArray<EntryRule> = [
  {
    path: 'category.name',
    keyPath: 'category.name',
    mode: 'entity',
    idField: 'id',
  },
]

@ApiController('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly translationEntryService: TranslationEntryService,
  ) {}

  private async batchCategoryEntryTranslations(
    lang: string,
    items: Array<
      { type?: string; category?: { id: unknown } | null } | null | undefined
    >,
  ): Promise<EntryMaps> {
    const categoryIds = new Set<string>()
    for (const item of items) {
      if (item?.type === 'post' && item?.category?.id) {
        categoryIds.add(String(item.category.id))
      }
    }
    return this.translationEntryService.getTranslationsBatch(lang, {
      entityLookups: categoryIds.size
        ? [{ keyPath: 'category.name', lookupKeys: categoryIds }]
        : [],
    })
  }

  @HttpCache.disable
  @Get()
  async search(@Query() query: SearchDto, @Lang() lang?: string) {
    const result = await this.searchService.search(query)
    if (lang) {
      const entryMaps = await this.batchCategoryEntryTranslations(
        lang,
        result.data,
      )
      for (const item of result.data) {
        if ((item as any)?.type === 'post' && (item as any)?.category) {
          applyTranslationEntriesInPlace(
            item as Record<string, any>,
            entryMaps,
            CATEGORY_NAME_RULES,
          )
        }
      }
    }
    return result
  }

  @Post('/rebuild')
  @Auth()
  async rebuild(@Query() query: SearchRebuildQueryDto) {
    const result = await this.searchService.rebuildSearchDocuments({
      force: query.force ?? false,
    })
    return result
  }

  @Post('/rebuild/:refType/:refId')
  @Auth()
  async rebuildOne(@Param() params: SearchRebuildRefParamDto) {
    const result = await this.searchService.rebuildSingleRef(
      params.refType,
      params.refId,
    )
    return result
  }

  @Get('/admin/documents')
  @Auth()
  @HttpCache.disable
  async adminListDocuments(@Query() query: SearchAdminListDto) {
    const result = await this.searchService.adminListDocuments(query)
    return result
  }

  @Get('/:type')
  @HttpCache.disable
  async searchByType(
    @Query() query: SearchDto,
    @Param('type') type: string,
    @Lang() lang?: string,
  ) {
    type = type.toLowerCase()
    let result: any
    switch (type) {
      case 'post': {
        result = await this.searchService.searchPost(query)
        break
      }
      case 'note': {
        result = await this.searchService.searchNote(query)
        break
      }
      case 'page': {
        result = await this.searchService.searchPage(query)
        break
      }
      default: {
        throw createAppException(AppErrorCode.INVALID_SEARCH_TYPE, { type })
      }
    }
    if (lang && type === 'post') {
      const entryMaps = await this.batchCategoryEntryTranslations(
        lang,
        result.data,
      )
      for (const item of result.data) {
        if ((item as any)?.category) {
          applyTranslationEntriesInPlace(
            item as Record<string, any>,
            entryMaps,
            CATEGORY_NAME_RULES,
          )
        }
      }
    }
    return result
  }
}
