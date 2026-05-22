import { forwardRef, Global, Module } from '@nestjs/common'

import { CATEGORY_SERVICE_TOKEN } from '~/constants/injection.constant'

import { AiModule } from '../ai/ai.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { CategoryController } from './category.controller'
import { CategoryRepository } from './category.repository'
import { CategoryService } from './category.service'

@Global()
@Module({
  providers: [
    CategoryRepository,
    CategoryService,
    { provide: CATEGORY_SERVICE_TOKEN, useExisting: CategoryService },
  ],
  exports: [CategoryService, CategoryRepository, CATEGORY_SERVICE_TOKEN],
  controllers: [CategoryController],
  imports: [SlugTrackerModule, forwardRef(() => AiModule)],
})
export class CategoryModule {}
