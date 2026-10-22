import { MarkdownTranslationStrategy as BaseMarkdownTranslationStrategy } from '@mx-space/ai/translation'
import { Injectable } from '@nestjs/common'

import { TranslationReviewerService } from '../reviewer.service'

@Injectable()
export class MarkdownTranslationStrategy extends BaseMarkdownTranslationStrategy {
  constructor(reviewerService: TranslationReviewerService) {
    super(reviewerService)
  }
}
