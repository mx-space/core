import { createRedisProvider } from '@/mock/modules/redis.mock'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import {
  CATEGORY_SERVICE_TOKEN,
  DRAFT_SERVICE_TOKEN,
  POST_SERVICE_TOKEN,
} from '~/constants/injection.constant'
import { CategoryModel } from '~/modules/category/category.model'
import { CategoryService } from '~/modules/category/category.service'
import { CommentModel } from '~/modules/comment/comment.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { DraftModel } from '~/modules/draft/draft.model'
import { DraftService } from '~/modules/draft/draft.service'
import { PostController } from '~/modules/post/post.controller'
import { PostModel } from '~/modules/post/post.model'
import { PostService } from '~/modules/post/post.service'
import { SlugTrackerModel } from '~/modules/slug-tracker/slug-tracker.model'
import { SlugTrackerService } from '~/modules/slug-tracker/slug-tracker.service'
import { UserModel } from '~/modules/user/user.model'
import { UserService } from '~/modules/user/user.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { MockingCountingInterceptor } from 'test/mock/interceptors/counting.interceptor'
import { authProvider } from 'test/mock/modules/auth.mock'
import { commentProvider } from 'test/mock/modules/comment.mock'
import { configProvider } from 'test/mock/modules/config.mock'
import { gatewayProviders } from 'test/mock/modules/gateway.mock'
import { countingServiceProvider } from 'test/mock/processors/counting.mock'
import { eventEmitterProvider } from 'test/mock/processors/event.mock'
import {
  fileReferenceProvider,
  imageMigrationProvider,
  imageServiceProvider,
} from 'test/mock/processors/file.mock'
import { translationEnhancerProvider } from 'test/mock/processors/translation-enhancer.mock'
import MockDbData, { categoryModels } from './post.e2e-mock.db'

describe('PostController (e2e)', async () => {
  let model: MongooseModel<PostModel>
  let categoryModel: MongooseModel<CategoryModel>
  let createdPostIds: string[] = []

  const proxy = createE2EApp({
    controllers: [PostController],
    providers: [
      PostService,
      {
        provide: POST_SERVICE_TOKEN,
        useExisting: PostService,
      },
      imageServiceProvider,
      CategoryService,
      {
        provide: CATEGORY_SERVICE_TOKEN,
        useExisting: CategoryService,
      },
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
          async replaceTextMacro(text: string) {
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
      DraftService,
      {
        provide: DRAFT_SERVICE_TOKEN,
        useExisting: DraftService,
      },
      fileReferenceProvider,
      imageMigrationProvider,
      translationEnhancerProvider,
    ],
    imports: [],
    models: [
      PostModel,
      OptionModel,
      UserModel,
      CategoryModel,
      CommentModel,
      SlugTrackerModel,
      DraftModel,
    ],
    async pourData(modelMap) {
      // @ts-ignore
      const { model: _model } = modelMap.get(PostModel) as {
        model: MongooseModel<PostModel>
      }
      // @ts-ignore
      const { model: _categoryModel } = modelMap.get(CategoryModel) as {
        model: MongooseModel<CategoryModel>
      }

      await _categoryModel.create(categoryModels)
      categoryModel = _categoryModel

      model = _model
      for await (const data of MockDbData) {
        await _model.create(data)
      }
    },
  })

  afterAll(async () => {
    await model.deleteMany({})
    await categoryModel.deleteMany({})
  })

  afterEach(async () => {
    for (const id of createdPostIds) {
      await model.deleteOne({ _id: id })
    }
    createdPostIds = []
  })

  describe('GET /', () => {
    test('basic pagination', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts`,
      })

      expect(data.statusCode).toBe(200)
      expect(data.json()).toMatchObject({
        data: expect.any(Array),
        pagination: expect.any(Object),
      })
    })

    test('filter by year', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts`,
        query: {
          year: '2022',
        },
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      expect(json.data.length).toBeGreaterThanOrEqual(0)
      json.data.forEach((post: { created: string }) => {
        expect(new Date(post.created).getFullYear()).toBe(2022)
      })
    })

    test('filter by categoryIds', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts`,
        query: {
          categoryIds: '5d367eceaceeed0cabcee4b2',
        },
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      expect(json.data.length).toBe(5)
    })

    test('hide unpublished for visitors', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts`,
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      json.data.forEach((post: { is_published: boolean }) => {
        expect(post.is_published).not.toBe(false)
      })
    })

    test('show unpublished for authenticated users', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts`,
        headers: {
          ...authPassHeader,
        },
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      const hasUnpublished = json.data.some(
        (post: { is_published: boolean }) => post.is_published === false,
      )
      expect(hasUnpublished).toBe(true)
    })
  })

  describe('GET /:id', () => {
    let testPostId: string

    beforeAll(async () => {
      const post = await model.findOne({ slug: 'post-1' })
      testPostId = post!._id.toString()
    })

    test('return post by id', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/${testPostId}`,
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      expect(json.title).toBe('Post 1')
    })

    test('return 404 for non-existent id', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/507f1f77bcf86cd799439011`,
      })

      expect(data.statusCode).toBe(404)
    })

    test('hide unpublished for visitors', async () => {
      const unpublishedPost = await model.findOne({ isPublished: false })

      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/${unpublishedPost!._id.toString()}`,
      })

      expect(data.statusCode).toBe(404)
    })

    test('show unpublished for authenticated users', async () => {
      const unpublishedPost = await model.findOne({ isPublished: false })

      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/${unpublishedPost!._id.toString()}`,
        headers: {
          ...authPassHeader,
        },
      })

      expect(data.statusCode).toBe(200)
    })
  })

  describe('GET /:category/:slug', () => {
    test('return post by category and slug', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/category-1/post-1`,
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      expect(json.title).toBe('Post 1')
      expect(json.slug).toBe('post-1')
    })

    test('return 404 for non-existent', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/category-1/non-existent-slug`,
      })

      expect(data.statusCode).toBe(404)
    })

    test('hide unpublished for visitors', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/category-1/unpublished-post-16`,
      })

      expect(data.statusCode).toBe(404)
    })
  })

  describe('GET /latest', () => {
    test('return latest published post', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/latest`,
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      expect(json.title).toBeDefined()
    })
  })

  describe('GET /get-url/:slug', () => {
    test('return post url', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/get-url/post-1`,
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      expect(json.path).toBe('/category-1/post-1')
    })

    test('return 404 for non-existent slug', async () => {
      const data = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/posts/get-url/non-existent`,
      })

      expect(data.statusCode).toBe(404)
    })
  })

  describe('POST /', () => {
    test('return 401 without auth', async () => {
      const data = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/posts`,
        payload: {
          title: 'New Post',
          text: 'New Content',
          slug: 'new-post',
          categoryId: '5d367eceaceeed0cabcee4b1',
        },
      })

      expect(data.statusCode).toBe(401)
    })

    test('create post with valid data', async () => {
      const data = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/posts`,
        payload: {
          title: 'Created Post',
          text: 'Created Content',
          slug: 'created-post',
          categoryId: '5d367eceaceeed0cabcee4b1',
        },
        headers: {
          ...authPassHeader,
        },
      })

      expect(data.statusCode).toBe(201)
      const json = data.json()
      expect(json.title).toBe('Created Post')
      expect(json.slug).toBe('created-post')
      createdPostIds.push(json.id)
    })

    test('return error for invalid category', async () => {
      const data = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/posts`,
        payload: {
          title: 'New Post',
          text: 'New Content',
          slug: 'new-post-invalid-cat',
          categoryId: '507f1f77bcf86cd799439011',
        },
        headers: {
          ...authPassHeader,
        },
      })

      expect([400, 404, 500]).toContain(data.statusCode)
    })
  })

  describe('PUT /:id', () => {
    let testPostId: string

    beforeAll(async () => {
      const post = await model.create({
        title: 'To Update',
        text: 'Original',
        slug: 'to-update',
        categoryId: '5d367eceaceeed0cabcee4b1',
        isPublished: true,
      })
      testPostId = post._id.toString()
    })

    afterAll(async () => {
      await model.deleteOne({ _id: testPostId })
    })

    test('return 401 without auth', async () => {
      const data = await proxy.app.inject({
        method: 'PUT',
        url: `${apiRoutePrefix}/posts/${testPostId}`,
        payload: {
          title: 'Updated',
          text: 'Updated Content',
          slug: 'to-update',
          categoryId: '5d367eceaceeed0cabcee4b1',
        },
      })

      expect(data.statusCode).toBe(401)
    })

    test('update post', async () => {
      const data = await proxy.app.inject({
        method: 'PUT',
        url: `${apiRoutePrefix}/posts/${testPostId}`,
        payload: {
          title: 'Updated Title',
          text: 'Updated Content',
          slug: 'to-update',
          categoryId: '5d367eceaceeed0cabcee4b1',
        },
        headers: {
          ...authPassHeader,
        },
      })

      expect(data.statusCode).toBe(200)
      const json = data.json()
      expect(json.title).toBe('Updated Title')
    })
  })

  describe('PATCH /:id', () => {
    let testPostId: string

    beforeAll(async () => {
      const post = await model.create({
        title: 'To Patch',
        text: 'Original',
        slug: 'to-patch',
        categoryId: '5d367eceaceeed0cabcee4b1',
        isPublished: true,
      })
      testPostId = post._id.toString()
    })

    afterAll(async () => {
      await model.deleteOne({ _id: testPostId })
    })

    test('return 401 without auth', async () => {
      const data = await proxy.app.inject({
        method: 'PATCH',
        url: `${apiRoutePrefix}/posts/${testPostId}`,
        payload: {
          title: 'Patched',
        },
      })

      expect(data.statusCode).toBe(401)
    })

    test('partial update post', async () => {
      const data = await proxy.app.inject({
        method: 'PATCH',
        url: `${apiRoutePrefix}/posts/${testPostId}`,
        payload: {
          title: 'Patched Title',
        },
        headers: {
          ...authPassHeader,
        },
      })

      expect(data.statusCode).toBe(204)

      const updated = await model.findById(testPostId)
      expect(updated!.title).toBe('Patched Title')
      expect(updated!.text).toBe('Original')
    })
  })

  describe('DELETE /:id', () => {
    let testPostId: string

    beforeEach(async () => {
      const post = await model.create({
        title: 'To Delete',
        text: 'Content',
        slug: `to-delete-${Date.now()}`,
        categoryId: '5d367eceaceeed0cabcee4b1',
        isPublished: true,
      })
      testPostId = post._id.toString()
    })

    test('return 401 without auth', async () => {
      const data = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/posts/${testPostId}`,
      })

      expect(data.statusCode).toBe(401)
      await model.deleteOne({ _id: testPostId })
    })

    test('delete post', async () => {
      const data = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/posts/${testPostId}`,
        headers: {
          ...authPassHeader,
        },
      })

      expect(data.statusCode).toBe(204)

      const deleted = await model.findById(testPostId)
      expect(deleted).toBeNull()
    })
  })

  describe('PATCH /:id/publish', () => {
    let testPostId: string

    beforeAll(async () => {
      const post = await model.create({
        title: 'To Toggle Publish',
        text: 'Content',
        slug: 'to-toggle-publish',
        categoryId: '5d367eceaceeed0cabcee4b1',
        isPublished: true,
      })
      testPostId = post._id.toString()
    })

    afterAll(async () => {
      await model.deleteOne({ _id: testPostId })
    })

    test('return 401 without auth', async () => {
      const data = await proxy.app.inject({
        method: 'PATCH',
        url: `${apiRoutePrefix}/posts/${testPostId}/publish`,
        payload: {
          isPublished: false,
        },
      })

      expect(data.statusCode).toBe(401)
    })

    test('toggle publish status', async () => {
      const data = await proxy.app.inject({
        method: 'PATCH',
        url: `${apiRoutePrefix}/posts/${testPostId}/publish`,
        payload: {
          isPublished: false,
        },
        headers: {
          ...authPassHeader,
        },
      })

      expect(data.statusCode).toBe(200)
      expect(data.json()).toMatchObject({ success: true })

      const updated = await model.findById(testPostId)
      expect(updated!.isPublished).toBe(false)
    })
  })
})
