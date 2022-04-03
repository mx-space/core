import pluralize from 'pluralize'

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

import { Auth } from '~/common/decorator/auth.decorator'
import { Paginator } from '~/common/decorator/http.decorator'
import { EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { BaseModel } from '~/shared/model/base.model'
import { InjectModel } from '~/transformers/model.transformer'

export type BaseCrudModuleType<T> = {
  _model: MongooseModel<T>
}
export function BaseCrudFactory<
  T extends AnyParamConstructor<BaseModel & { id?: string }>,
>({ model }: { model: T }): Type<any> {
  const prefix = model.name.toLowerCase().replace(/model$/, '')
  const pluralizeName = pluralize(prefix) as string
  const tagPrefix =
    pluralizeName.charAt(0).toUpperCase() + pluralizeName.slice(1)

  const eventNamePrefix = `${pluralizeName.toUpperCase()}_`

  class PDto extends PartialType(model as any) {}

  class Dto extends model {}

  @ApiTags(`${tagPrefix} Routes`)
  @Controller(pluralizeName)
  class BaseCrud {
    constructor(
      @InjectModel(model) private readonly _model: MongooseModel<T>,
      private readonly eventManager: EventManagerService,
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
      return await this._model
        .create({ ...body, created: new Date() })
        .then((res) => {
          this.eventManager.broadcast(
            `${eventNamePrefix}CREATE` as any,
            res.toObject(),
            {
              scope: EventScope.TO_SYSTEM_VISITOR,
            },
          )
          return res
        })
    }

    @Put('/:id')
    @Auth()
    async update(@Body() body: Dto, @Param() param: MongoIdDto) {
      return await this._model
        .findOneAndUpdate(
          { _id: param.id as any },
          {
            ...body,
            modified: new Date(),
          } as any,
          { new: true },
        )
        .lean()
        .then((res) => {
          this.eventManager.broadcast(`${eventNamePrefix}UPDATE` as any, res, {
            scope: EventScope.TO_SYSTEM_VISITOR,
          })
          return res
        })
    }

    @Patch('/:id')
    @Auth()
    @HttpCode(204)
    async patch(@Body() body: PDto, @Param() param: MongoIdDto) {
      await this.update(body, param)
      return
    }

    @Delete('/:id')
    @Auth()
    @HttpCode(204)
    async delete(@Param() param: MongoIdDto) {
      await this._model.deleteOne({ _id: param.id as any })

      await this.eventManager.broadcast(
        `${eventNamePrefix}DELETE` as any,
        param.id,
        {
          scope: EventScope.TO_SYSTEM_VISITOR,
        },
      )

      return
    }
  }

  return BaseCrud
}
