import { Get, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import {
  SearchAdminListDto,
  SearchDto,
  SearchRebuildQueryDto,
  SearchRebuildRefParamDto,
} from '~/modules/search/search.schema'

import { SearchService } from './search.service'

@ApiController('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @HttpCache.disable
  @Get()
  search(@Query() query: SearchDto) {
    return this.searchService.search(query)
  }

  @Post('/rebuild')
  @Auth()
  rebuild(@Query() query: SearchRebuildQueryDto) {
    return this.searchService.rebuildSearchDocuments({
      force: query.force ?? false,
    })
  }

  @Post('/rebuild/:refType/:refId')
  @Auth()
  rebuildOne(@Param() params: SearchRebuildRefParamDto) {
    return this.searchService.rebuildSingleRef(params.refType, params.refId)
  }

  @Get('/admin/documents')
  @Auth()
  @HttpCache.disable
  adminListDocuments(@Query() query: SearchAdminListDto) {
    return this.searchService.adminListDocuments(query)
  }

  @Get('/:type')
  @HttpCache.disable
  searchByType(@Query() query: SearchDto, @Param('type') type: string) {
    type = type.toLowerCase()
    switch (type) {
      case 'post': {
        return this.searchService.searchPost(query)
      }
      case 'note': {
        return this.searchService.searchNote(query)
      }
      case 'page': {
        return this.searchService.searchPage(query)
      }

      default: {
        throw new BizException(ErrorCodeEnum.InvalidSearchType, type)
      }
    }
  }
}
