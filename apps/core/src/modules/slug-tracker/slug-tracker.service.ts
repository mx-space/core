import { Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import type { ArticleTypeEnum } from '~/constants/article.constant'
import { InjectModel } from '~/transformers/model.transformer'
import { SlugTrackerModel } from './slug-tracker.model'

@Injectable()
export class SlugTrackerService {
  constructor(
    @InjectModel(SlugTrackerModel)
    private readonly slugTrackerModel: ReturnModelType<typeof SlugTrackerModel>,
  ) {}

  createTracker(slug: string, type: ArticleTypeEnum, targetId: string) {
    return this.slugTrackerModel.create({ slug, type, targetId })
  }

  findTrackerBySlug(slug: string, type: ArticleTypeEnum) {
    return this.slugTrackerModel.findOne({ slug, type }).lean()
  }
  deleteAllTracker(targetId: string) {
    return this.slugTrackerModel.deleteMany({ targetId })
  }
}
