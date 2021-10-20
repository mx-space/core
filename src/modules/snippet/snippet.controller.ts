import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { Auth } from '~/common/decorator/auth.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { transformDataToPaginate } from '~/utils/transfrom.util'
import { SnippetModel } from './snippet.model'
import { SnippetService } from './snippet.service'

@ApiName
@Controller('snippets')
export class SnippetController {
  constructor(private readonly snippetService: SnippetService) {}

  @Get('/')
  @Auth()
  async getList(@Query() query: PagerDto) {
    const { page, size, select = '' } = query

    return transformDataToPaginate(
      await this.snippetService.model.paginate(
        {},
        { page, limit: size, select },
      ),
    )
  }

  @Post('/')
  @Auth()
  async create(@Body() body: SnippetModel) {
    return await this.snippetService.create(body)
  }

  @Get('/:id')
  async getSnippetById(
    @Param() param: MongoIdDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { id } = param
    const snippet = await this.snippetService.getSnippetById(id)
    if (snippet.private && !isMaster) {
      throw new ForbiddenException('snippet is private')
    }
    return snippet
  }

  @Get('/name/:reference/:name')
  async getSnippetByName(
    @Param('name') name: string,
    @Param('reference') reference: string,
    @IsMaster() isMaster: boolean,
  ) {
    if (typeof name !== 'string') {
      throw new ForbiddenException('name should be string')
    }

    if (typeof reference !== 'string') {
      throw new ForbiddenException('reference should be string')
    }

    const snippet = await this.snippetService.getSnippetByName(name, reference)

    if (snippet.private && !isMaster) {
      throw new ForbiddenException('snippet is private')
    }
    return snippet
  }

  @Put('/:id')
  @Auth()
  async update(@Param() param: MongoIdDto, @Body() body: SnippetModel) {
    const { id } = param

    await this.snippetService.update(id, body)
    return await this.snippetService.getSnippetById(id)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() param: MongoIdDto) {
    const { id } = param
    await this.snippetService.delete(id)
  }
}
