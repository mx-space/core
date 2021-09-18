import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { DocumentType } from '@typegoose/typegoose'
import { IsMaster } from '~/common/decorator/role.decorator'
import { VisitDocument } from '~/common/decorator/update-count.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import {
  addConditionToSeeHideContent,
  addYearCondition,
} from '~/utils/query.util'
import { transformDataToPaginate } from '~/utils/transfrom.util'
import { NoteQueryDto } from './note.dto'
import { NidOrIdArgsDto, PasswordArgsDto } from './note.input'
import {
  NoteItemAggregateModel,
  NoteModel,
  NotePaginatorModel,
} from './note.model'
import { NoteService } from './note.service'

@Resolver()
export class NoteResolver {
  constructor(private readonly service: NoteService) {}

  @Query(() => NoteItemAggregateModel)
  @VisitDocument('Note')
  async getNoteById(
    @Args() args: NidOrIdArgsDto,
    @IsMaster() isMaster: boolean,
    @Args() { password }: PasswordArgsDto,
  ) {
    const { id, nid } = args
    if (!id && !nid) {
      throw new UnprocessableEntityException('id or nid must choice one')
    }
    const currentNote = (await this.service.findOneByIdOrNid(
      id ?? nid,
    )) as DocumentType<NoteModel>

    if (!currentNote) {
      throw new CannotFindException()
    }
    if (
      (!this.service.checkPasswordToAccess(currentNote, password) ||
        currentNote.hide) &&
      !isMaster
    ) {
      throw new ForbiddenException('不要偷看人家的小心思啦~')
    }
    const condition = addConditionToSeeHideContent(isMaster)
    const prev = await this.service.model
      .findOne({
        ...condition,
        created: {
          $gt: currentNote.created,
        },
      })
      .sort({ created: 1 })

    const next = await this.service.model
      .findOne({
        ...condition,
        created: {
          $lt: currentNote.created,
        },
      })
      .sort({ created: -1 })

    return { data: currentNote, next, prev }
  }

  @Query(() => NoteItemAggregateModel)
  @VisitDocument('Note')
  async getLastestNote(@IsMaster() isMaster: boolean) {
    const doc = (await this.service.model
      .findOne({ ...addConditionToSeeHideContent(isMaster) })
      .sort({ created: -1 })) as DocumentType<NoteModel>
    if (!doc) {
      throw new CannotFindException()
    }
    const id = doc._id.toString()
    return await this.getNoteById({ id }, isMaster, {})
  }

  @Query(() => NotePaginatorModel)
  async getNotesWithPager(
    @Args() args: NoteQueryDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { page, size, sortBy, sortOrder, year } = args
    const condition = {
      ...addConditionToSeeHideContent(isMaster),
      ...addYearCondition(year),
    }
    return transformDataToPaginate(
      await this.service.model.paginate(condition, {
        limit: size,
        page,
        sort: sortBy ? { [sortBy]: sortOrder || -1 } : { created: -1 },
      }),
    )
  }
}
