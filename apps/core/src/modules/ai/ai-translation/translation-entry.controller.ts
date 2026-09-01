import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'

import {
  type GenerateEntriesDto,
  GenerateEntriesSchema,
  type QueryEntriesDto,
  QueryEntriesSchema,
  type UpdateEntryDto,
  UpdateEntrySchema,
} from './translation-entry.schema'
import { TranslationEntryService } from './translation-entry.service'

@ApiController('ai/translations/entries')
export class TranslationEntryController {
  constructor(
    private readonly translationEntryService: TranslationEntryService,
  ) {}

  @Post('/generate')
  @HttpCode(200)
  @Auth()
  generateEntries(
    @Body({ schema: GenerateEntriesSchema }) body?: GenerateEntriesDto,
  ) {
    return this.translationEntryService.generateTranslations(body ?? {})
  }

  @Get('/')
  @Auth()
  async queryEntries(
    @Query({ schema: QueryEntriesSchema }) query: QueryEntriesDto,
  ) {
    const result = await this.translationEntryService.findEntries(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Patch('/:id')
  @Auth()
  updateEntry(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: UpdateEntrySchema }) body: UpdateEntryDto,
  ) {
    return this.translationEntryService.updateEntry(
      params.id,
      body.translatedText,
    )
  }

  @Delete('/:id')
  @Auth()
  deleteEntry(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.translationEntryService.deleteEntry(params.id)
  }
}
