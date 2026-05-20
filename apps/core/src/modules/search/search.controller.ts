import { Get, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
import {
  SearchAdminListDto,
  SearchDto,
  SearchRebuildQueryDto,
  SearchRebuildRefParamDto,
} from '~/modules/search/search.schema'

import { SearchService } from './search.service'

@ApiController('search')
@ResponseV2()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @HttpCache.disable
  @Get()
  async search(@Query() query: SearchDto) {
    const result = await this.searchService.search(query)
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
  async searchByType(@Query() query: SearchDto, @Param('type') type: string) {
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
    return result
  }
}
