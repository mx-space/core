import { BadRequestException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getModelToken } from '~/transformers/model.transformer'
import { AuthService } from '~/modules/auth/auth.service'
import { UserModel } from '~/modules/user/user.model'
import { UserService } from '~/modules/user/user.service'
import { CacheService } from '~/processors/cache/cache.service'

describe('test UserModule service', () => {
  let userService: UserService
  beforeEach(async () => {
    const storedUserList = []
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        AuthService,
        CacheService,
        {
          provide: getModelToken(UserModel.name),
          useValue: {
            countDocuments() {
              return Promise.resolve(storedUserList.length)
            },
            create(doc) {
              storedUserList.push(doc)
              return Promise.resolve(doc)
            },
            findOne() {
              const user = storedUserList[0]
              if (user) {
                user.lean = () => Promise.resolve(user)
                return user
              }
              return {
                lean: () => Promise.resolve(null),
                valueOf() {
                  return null
                },
              }
            },
          },
        },
      ],
    })
      .overrideProvider(AuthService)
      .useValue({
        signToken() {
          return 'fake token'
        },
      })
      .overrideProvider(CacheService)
      .useValue({})
      .compile()
    userService = module.get<UserService>(UserService)
  })

  it('getMaster', async () => {
    await expect(userService.getMaster()).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await userService.createMaster({
      username: 'user-1',
      name: 'user',
      password: '1 ',
    })
    expect((await userService.getMaster()).username).toBe('user-1')
  })
  it('createUser', async () => {
    const user1 = await userService.createMaster({
      username: 'user-a',
      password: '123456',
      name: 'name',
    })
    expect(user1.username).toBe('user-a')

    await expect(
      userService.createMaster({
        username: 'user-b',
        password: '123456',
        name: 'name',
      }),
    ).rejects.toThrow(BadRequestException)
  })
})
