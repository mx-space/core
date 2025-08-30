import { createRedisProvider } from '@/mock/modules/redis.mock'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { CategoryModel } from '~/modules/category/category.model'
import { CategoryService } from '~/modules/category/category.service'
import { CommentModel } from '~/modules/comment/comment.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { PostController } from '~/modules/post/post.controller'
import { PostModel } from '~/modules/post/post.model'
import { PostService } from '~/modules/post/post.service'
import { SlugTrackerModel } from '~/modules/slug-tracker/slug-tracker.model'
import { SlugTrackerService } from '~/modules/slug-tracker/slug-tracker.service'
import { UserModel } from '~/modules/user/user.model'
import { UserService } from '~/modules/user/user.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { MockingCountingInterceptor } from 'test/mock/interceptors/counting.interceptor'
import { authProvider } from 'test/mock/modules/auth.mock'
import { commentProvider } from 'test/mock/modules/comment.mock'
import { configProvider } from 'test/mock/modules/config.mock'
import { gatewayProviders } from 'test/mock/modules/gateway.mock'
import { countingServiceProvider } from 'test/mock/processors/counting.mock'
import { eventEmitterProvider } from 'test/mock/processors/event.mock'
import MockDbData, { categoryModels } from './post.e2e-mock.db'

describe('PostController (e2e)', async () => {
  let model: MongooseModel<PostModel>
  const proxy = createE2EApp({
    controllers: [PostController],
    providers: [
      PostService,
      ImageService,
      CategoryService,
      SlugTrackerService,
      {
        provide: APP_INTERCEPTOR,
        useClass: MockingCountingInterceptor,
      },
      await createRedisProvider(),

      commentProvider,

      {
        provide: TextMacroService,
        useValue: {
          async replaceTextMacro(text) {
            return text
          },
        },
      },
      HttpService,
      configProvider,

      UserService,
      ...eventEmitterProvider,
      ...gatewayProviders,
      authProvider,

      countingServiceProvider,
    ],
    imports: [],
    models: [
      PostModel,
      OptionModel,
      UserModel,
      CategoryModel,
      CommentModel,
      SlugTrackerModel,
    ],
    async pourData(modelMap) {
      // @ts-ignore
      const { model: _model } = modelMap.get(PostModel) as {
        model: MongooseModel<PostModel>
      }

      await modelMap.get(CategoryModel).model.create(categoryModels)

      model = _model
      for await (const data of MockDbData) {
        await _model.create(data)
      }
    },
  })

  afterAll(async () => {
    await model.deleteMany({})
  })

  test('GET /', async () => {
    const data = await proxy.app.inject({
      method: 'GET',
      url: '/posts',
    })

    expect(data.statusCode).toBe(200)
    expect(data.json()).toMatchObject({
      data: expect.any(Array),
      pagination: expect.any(Object),
    })
  })
})
