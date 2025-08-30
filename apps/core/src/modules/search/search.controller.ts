import {
  BadRequestException,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { SearchDto } from '~/modules/search/search.dto'
import { FastifyReply } from 'fastify'
import { SearchService } from './search.service'

@ApiController('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('/:type')
  @HttpCache.disable
  @HTTPDecorators.Paginator
  searchByType(
    @Query() query: SearchDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @Param('type') type: string,
  ) {
    type = type.toLowerCase()
    switch (type) {
      case 'post': {
        return this.searchService.searchPost(query)
      }
      case 'note':
        return this.searchService.searchNote(query, isAuthenticated)

      default:
        throw new BadRequestException(`Invalid search type: ${type}`)
    }
  }

  @Get('/algolia')
  async search(@Query() query: SearchDto) {
    return this.searchService.searchAlgolia(query)
  }

  @Post('/algolia/push')
  @Auth()
  async pushAlgoliaAllManually() {
    return this.searchService.pushAllToAlgoliaSearch()
  }

  @Get('/algolia/import-json')
  @Auth()
  async getAlgoliaIndexJsonFile(@Res() res: FastifyReply) {
    const documents = await this.searchService.buildAlgoliaIndexData()
    res.header('Content-Type', 'application/json')
    res.header('Content-Disposition', 'attachment; filename=algolia-index.json')
    res.send(JSON.stringify(documents))
  }
}
