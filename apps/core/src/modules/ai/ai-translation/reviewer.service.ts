import { TranslationReviewer } from '@mx-space/ai/translation'
import { Injectable } from '@nestjs/common'

export type { ReviewerIssue, ReviewerOutput } from '@mx-space/ai/translation'

@Injectable()
export class TranslationReviewerService extends TranslationReviewer {}
