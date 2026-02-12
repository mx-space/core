import { Global, Module } from '@nestjs/common'
import { CATEGORY_SERVICE_TOKEN } from '~/constants/injection.constant'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { CategoryController } from './category.controller'
import { CategoryService } from './category.service'

@Global()
@Module({
  providers: [
    CategoryService,
    { provide: CATEGORY_SERVICE_TOKEN, useExisting: CategoryService },
  ],
  exports: [CategoryService, CATEGORY_SERVICE_TOKEN],
  controllers: [CategoryController],
  imports: [SlugTrackerModule],
})
export class CategoryModule {}
