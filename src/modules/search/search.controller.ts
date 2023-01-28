import { BadRequestException, Get, Param, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { ApiName } from '~/common/decorators/openapi.decorator'
import { IsMaster } from '~/common/decorators/role.decorator'
import { SearchDto } from '~/modules/search/search.dto'

import { SearchService } from './search.service'

@ApiController('search')
@ApiName
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('/:type')
  @HttpCache.disable
  @HTTPDecorators.Paginator
  searchByType(
    @Query() query: SearchDto,
    @IsMaster() isMaster: boolean,
    @Param('type') type: string,
  ) {
    type = type.toLowerCase()
    switch (type) {
      case 'post': {
        return this.searchService.searchPost(query)
      }
      case 'note':
        return this.searchService.searchNote(query, isMaster)

      default:
        throw new BadRequestException(`Invalid search type: ${type}`)
    }
  }

  @Get('/algolia')
  async search(@Query() query: SearchDto) {
    return this.searchService.searchAlgolia(query)
  }
}
