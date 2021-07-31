import { forwardRef } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getFakeCategoryModel, getFakePostModel } from 'test/db-model.mock'
import { CategoryModule } from '../category/category.module'
import { PostService } from './post.service'

describe('PostService', () => {
  let service: PostService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [getFakePostModel(), getFakeCategoryModel(), PostService],
      imports: [forwardRef(() => CategoryModule)],
    }).compile()

    service = module.get<PostService>(PostService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
