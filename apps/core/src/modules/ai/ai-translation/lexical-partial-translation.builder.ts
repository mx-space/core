import { LexicalPartialTranslationBuilder as BaseLexicalPartialTranslationBuilder } from '@mx-space/ai/translation'
import { Injectable } from '@nestjs/common'

import { LexicalService } from '~/processors/helper/helper.lexical.service'

export type {
  PartialLexicalTranslationResult,
  PartialLexicalTranslationStats,
} from '@mx-space/ai/translation'

@Injectable()
export class LexicalPartialTranslationBuilder extends BaseLexicalPartialTranslationBuilder {
  constructor(lexicalService: LexicalService) {
    super(lexicalService)
  }
}
