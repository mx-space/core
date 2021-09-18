import { Controller, Get, Param, Query } from '@nestjs/common'
import { HttpCache } from '~/common/decorator/cache.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { SearchDto } from '~/shared/dto/search.dto'
import { SearchService } from './search.service'

@Controller('search')
@ApiName
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('/search/:type')
  @HttpCache.disable
  searchByType(
    @Query() query: SearchDto,
    @IsMaster() isMaster: boolean,
    @Param('type') type: string,
  ) {
    type = type.toLowerCase()
    switch (type) {
      case 'post': {
        return this.searchService.searchPost(query, isMaster)
      }
      case 'note':
        return this.searchService.searchNote(query, isMaster)

      default:
        return this.searchService.searchAlgolia(query)
    }
  }
}
