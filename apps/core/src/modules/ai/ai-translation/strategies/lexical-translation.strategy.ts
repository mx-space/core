import { LexicalTranslationStrategy as BaseLexicalTranslationStrategy } from '@mx-space/ai/translation'
import { Injectable } from '@nestjs/common'

import { LexicalService } from '~/processors/helper/helper.lexical.service'

import { TranslationReviewerService } from '../reviewer.service'

@Injectable()
export class LexicalTranslationStrategy extends BaseLexicalTranslationStrategy {
  constructor(
    lexicalService: LexicalService,
    reviewerService: TranslationReviewerService,
  ) {
    super(lexicalService, reviewerService)
  }
}
