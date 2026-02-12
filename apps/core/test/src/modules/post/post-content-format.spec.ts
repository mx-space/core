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
import { HttpService } from '~/processors/helper/helper.http.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
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
import { translationProvider } from 'test/mock/processors/translation.mock'

describe('Post ContentFormat (e2e)', async () => {
  let categoryId: string

  const proxy = createE2EApp({
    controllers: [PostController],
    providers: [
      PostService,
      {
        provide: POST_SERVICE_TOKEN,
        useExisting: PostService,
      },
      LexicalService,
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
      HttpService,
      configProvider,
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
      translationProvider,
    ],
    imports: [],
    models: [
      PostModel,
      OptionModel,
      CategoryModel,
      CommentModel,
      SlugTrackerModel,
      DraftModel,
    ],
    async pourData(modelMap) {
      const { model: catModel } = modelMap.get(CategoryModel)!
      const cat = await catModel.create({
        name: 'test-category',
        slug: 'test-cat',
        type: 0,
      })
      categoryId = cat.id
    },
  })

  it('creates markdown post normally', async () => {
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/posts`,
      headers: authPassHeader,
      payload: {
        title: 'Markdown Post',
        text: '# Hello\n\nWorld',
        slug: 'markdown-post',
        categoryId,
      },
    })

    expect(res.statusCode).toBe(201)
    const json = res.json()
    expect(json.content_format).toBe('markdown')
  })

  it('creates lexical post with auto-generated text', async () => {
    const lexicalContent = JSON.stringify({
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Hello Lexical',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'heading',
            version: 1,
            tag: 'h1',
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'This is paragraph text.',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    })

    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/posts`,
      headers: authPassHeader,
      payload: {
        title: 'Lexical Post',
        text: '',
        slug: 'lexical-post',
        categoryId,
        contentFormat: ContentFormat.Lexical,
        content: lexicalContent,
      },
    })

    expect(res.statusCode).toBe(201)
    const json = res.json()
    expect(json.content_format).toBe('lexical')
    expect(json.content).toBe(lexicalContent)
    // text should be auto-generated from lexical content
    expect(json.text).toContain('Hello Lexical')
    expect(json.text).toContain('This is paragraph text.')
  })
})
