import { Get, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { SearchDto } from '~/modules/search/search.schema'

import { SearchService } from './search.service'

@ApiController('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @HttpCache.disable
  @Get()
  search(
    @Query() query: SearchDto,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    return this.searchService.search(query, isAuthenticated)
  }

  @Post('/rebuild')
  @Auth()
  rebuild() {
    return this.searchService.rebuildSearchDocuments()
  }

  @Get('/:type')
  @HttpCache.disable
  searchByType(
    @Query() query: SearchDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @Param('type') type: string,
  ) {
    type = type.toLowerCase()
    switch (type) {
      case 'post': {
        return this.searchService.searchPost(query, isAuthenticated)
      }
      case 'note': {
        return this.searchService.searchNote(query, isAuthenticated)
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
