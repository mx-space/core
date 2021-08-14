import { Test, TestingModule } from '@nestjs/testing'
import { DbModule } from '../helper/db.module'
import { PostModule } from '../post/post.module'
import { CategoryService } from './category.service'

describe('CategoryService', () => {
  let service: CategoryService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoryService],
      imports: [PostModule, DbModule],
    }).compile()

    service = module.get<CategoryService>(CategoryService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
