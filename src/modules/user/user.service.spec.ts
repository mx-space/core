import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from 'nestjs-typegoose'
import { UserService } from './user.service'

const fakeModel = jest.fn()

describe('UserService', () => {
  let service: UserService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken('UserModel'),
          useValue: fakeModel,
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
