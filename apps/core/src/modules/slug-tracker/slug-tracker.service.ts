import { Injectable } from '@nestjs/common'

import type { ArticleTypeEnum } from '~/constants/article.constant'

import { SlugTrackerRepository } from './slug-tracker.repository'

@Injectable()
export class SlugTrackerService {
  constructor(private readonly slugTrackerRepository: SlugTrackerRepository) {}

  createTracker(slug: string, type: ArticleTypeEnum, targetId: string) {
    return this.slugTrackerRepository.createTracker(slug, type, targetId)
  }

  findTrackerBySlug(slug: string, type: ArticleTypeEnum) {
    return this.slugTrackerRepository.findBySlug(slug, type)
  }
  deleteAllTracker(targetId: string, type?: ArticleTypeEnum) {
    if (type) {
      return this.slugTrackerRepository.deleteAllForTarget(type, targetId)
    }
    return this.slugTrackerRepository.deleteAllForTargetId(targetId)
  }
}
