import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Type,
} from '@nestjs/common'
import { ApiTags, PartialType } from '@nestjs/swagger'
import { AnyParamConstructor } from '@typegoose/typegoose/lib/types'
import { InjectModel } from 'nestjs-typegoose'
import pluralize from 'pluralize'
import { Auth } from '~/common/decorator/auth.decorator'
import { Paginator } from '~/common/decorator/http.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { BaseModel } from '~/shared/model/base.model'

export function BaseCrudFactory<
  T extends AnyParamConstructor<BaseModel & { id?: string }>,
>({ model }: { model: T }): Type<any> {
  const prefix = model.name.toLowerCase().replace(/model$/, '')
  const tagPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1)

  class PDto extends PartialType(model as any) {}

  class Dto extends model {}

  @ApiTags(tagPrefix + ' Routes')
  @Controller(pluralize(prefix))
  class BaseCrud {
    constructor(
      @InjectModel(model) private readonly _model: MongooseModel<T>,
    ) {}

    public get model() {
      return this._model
    }

    @Get('/:id')
    async get(@Param() param: MongoIdDto) {
      const { id } = param
      return await this._model.findById(id).lean()
    }

    @Get('/')
    @Paginator
    async gets(@Query() pager: PagerDto) {
      const { size, page, select, state } = pager
      // @ts-ignore
      return await this._model.paginate(state !== undefined ? { state } : {}, {
        limit: size,
        page,
        sort: { created: -1 },
        select,
      })
    }

    @Get('/all')
    async getAll() {
      return await this._model.find({}).sort({ created: -1 }).lean()
    }

    @Post('/')
    @Auth()
    async create(@Body() body: Dto) {
      return await this._model.create({ ...body, created: new Date() })
    }

    @Put('/:id')
    @Auth()
    async update(@Body() body: Dto, @Param() param: MongoIdDto) {
      await this._model
        .updateOne({ _id: param.id as any }, {
          ...body,
          modified: new Date(),
        } as any)
        .lean()
      return this._model.findById(param.id as any).lean()
    }

    @Patch('/:id')
    @Auth()
    @HttpCode(204)
    async patch(@Body() body: PDto, @Param() param: MongoIdDto) {
      await this._model
        .updateOne({ _id: param.id as any }, {
          ...body,
          modified: new Date(),
        } as any)
        .lean()
      return
    }

    @Delete('/:id')
    @Auth()
    @HttpCode(204)
    async delete(@Param() param: MongoIdDto) {
      await this._model.deleteOne({ _id: param.id as any })
      return
    }
  }

  return BaseCrud
}
