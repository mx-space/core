import { Test, TestingModule } from '@nestjs/testing'
import { getFakeCategoryModel } from 'test/db-model.mock'
import { CategoryService } from '../category/category.service'
import { DbModule } from '../helper/db.module'
import { PostService } from './post.service'

describe('PostService', () => {
  let service: PostService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostService, CategoryService, getFakeCategoryModel()],
      imports: [DbModule],
    }).compile()

    service = module.get<PostService>(PostService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
