import type { Type } from '@nestjs/common'
import {
  Body,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import pluralize from 'pluralize'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators, Paginator } from '~/common/decorators/http.decorator'
import { EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import type { EntityId } from '~/shared/id/entity-id'

export type ClassType<T> = new (...args: any[]) => T

export interface PgCrudRepository<TRow> {
  list: (
    page: number,
    size: number,
    filter?: Record<string, unknown>,
  ) => Promise<{ data: TRow[]; pagination: unknown }>
  findAll: () => Promise<TRow[]>
  findById: (id: EntityId | string) => Promise<TRow | null>
  create: (input: unknown) => Promise<TRow>
  update: (id: EntityId | string, patch: unknown) => Promise<TRow | null>
  deleteById: (id: EntityId | string) => Promise<TRow | null>
}

export interface BasePgCrudOptions<TRepo extends PgCrudRepository<any>> {
  /** Repository class to inject. Its `constructor.name` drives the URL prefix. */
  repository: ClassType<TRepo>
  /**
   * Optional URL/event prefix override (singular). Default derives from
   * the repository class name by stripping trailing `Repository`.
   *
   * Example: SayRepository → "say" → URL /says, events SAY_*.
   */
  prefix?: string
  /** Optional class to mix in (legacy compatibility with BaseCrudFactory). */
  classUpper?: ClassType<object>
}

/**
 * PostgreSQL-backed sibling of {@link BaseCrudFactory}. Same routes and
 * event semantics, but reads/writes through a {@link PgCrudRepository}
 * instead of a Mongoose model.
 */
export function BasePgCrudFactory<TRepo extends PgCrudRepository<any>>({
  repository,
  prefix,
  classUpper,
}: BasePgCrudOptions<TRepo>): Type<any> {
  const inferredPrefix =
    prefix ??
    repository.name
      .replace(/Repository$/, '')
      .replace(/^./, (c) => c.toLowerCase())
  const pluralizeName = pluralize(inferredPrefix)
  const eventNamePrefix = `${inferredPrefix.toUpperCase()}_`

  // Empty body DTOs — validation happens via Zod where needed. Mirrors
  // BaseCrudFactory which also leaves these open.
  class PDto {}
  class Dto {}

  const Upper = classUpper ?? class {}

  @ApiController(pluralizeName)
  class BasePgCrud extends Upper {
    constructor(
      @Inject(repository) protected readonly repo: TRepo,
      protected readonly eventManager: EventManagerService,
    ) {
      super()
    }

    public get repository() {
      return this.repo
    }

    @Get('/:id')
    async get(@Param() param: EntityIdDto) {
      return this.repo.findById(param.id)
    }

    @Get('/')
    @Paginator
    async gets(@Query() pager: PagerDto) {
      const size = pager.size ?? 10
      const page = pager.page ?? 1
      const filter: Record<string, unknown> = {}
      if (pager.state !== undefined) filter.state = pager.state
      return this.repo.list(page, size, filter)
    }

    @Get('/all')
    async getAll() {
      return this.repo.findAll()
    }

    @Post('/')
    @HTTPDecorators.Idempotence()
    @Auth()
    async create(@Body() body: Dto) {
      const res = await this.repo.create(body)
      this.eventManager.broadcast(`${eventNamePrefix}CREATE` as any, res, {
        scope: EventScope.TO_SYSTEM_VISITOR,
      })
      return res
    }

    @Put('/:id')
    @Auth()
    async update(@Body() body: Dto, @Param() param: EntityIdDto) {
      const res = await this.repo.update(param.id, body)
      this.eventManager.broadcast(`${eventNamePrefix}UPDATE` as any, res, {
        scope: EventScope.TO_SYSTEM_VISITOR,
      })
      return res
    }

    @Patch('/:id')
    @Auth()
    @HttpCode(204)
    async patch(@Body() body: PDto, @Param() param: EntityIdDto) {
      await this.update(body as any, param)
    }

    @Delete('/:id')
    @Auth()
    @HttpCode(204)
    async delete(@Param() param: EntityIdDto) {
      await this.repo.deleteById(param.id)
      await this.eventManager.broadcast(
        `${eventNamePrefix}DELETE` as any,
        { id: param.id },
        { scope: EventScope.ALL },
      )
    }
  }

  return BasePgCrud
}
