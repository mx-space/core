import { Test, TestingModule } from '@nestjs/testing'
import { getFakeCategoryModel, getFakePostModel } from 'test/db-model.mock'
import { PostModule } from '../post/post.module'
import { CategoryService } from './category.service'

describe('CategoryService', () => {
  let service: CategoryService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [getFakePostModel(), getFakeCategoryModel(), CategoryService],
      imports: [PostModule],
    }).compile()

    service = module.get<CategoryService>(CategoryService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
