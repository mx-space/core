import { Body, HttpCode, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

import {
  type MarkdownToLexicalDryRunDto,
  MarkdownToLexicalDryRunSchema,
} from './content-migration.schema'
import { ContentMigrationService } from './content-migration.service'

@ApiController('content-migrations')
export class ContentMigrationController {
  constructor(
    private readonly contentMigrationService: ContentMigrationService,
  ) {}

  @Post('/markdown-to-lexical/dry-run')
  @HttpCode(200)
  @Auth()
  dryRunMarkdownToLexical(
    @Body({ schema: MarkdownToLexicalDryRunSchema })
    body: MarkdownToLexicalDryRunDto,
  ) {
    return this.contentMigrationService.dryRunMarkdownToLexical(body)
  }
}
