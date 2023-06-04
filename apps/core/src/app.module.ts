import { DynamicModule, Module, NestModule, Type } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'

import { DEMO_MODE } from './app.config'
import { AppController } from './app.controller'
import { AllExceptionsFilter } from './common/filters/any-exception.filter'
import { RolesGuard } from './common/guards/roles.guard'
import { AnalyzeInterceptor } from './common/interceptors/analyze.interceptor'
import { HttpCacheInterceptor } from './common/interceptors/cache.interceptor'
import { CountingInterceptor } from './common/interceptors/counting.interceptor'
import { DbQueryInterceptor } from './common/interceptors/db-query.interceptor'
import { IdempotenceInterceptor } from './common/interceptors/idempotence.interceptor'
import { JSONTransformInterceptor } from './common/interceptors/json-transform.interceptor'
import { ResponseFilterInterceptor } from './common/interceptors/response-filter.interceptor'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { AggregateModule } from './modules/aggregate/aggregate.module'
import { AnalyzeModule } from './modules/analyze/analyze.module'
import { AuthModule } from './modules/auth/auth.module'
import { BackupModule } from './modules/backup/backup.module'
import { CategoryModule } from './modules/category/category.module'
import { CommentModule } from './modules/comment/comment.module'
import { ConfigsModule } from './modules/configs/configs.module'
import { DebugModule } from './modules/debug/debug.module'
import { DemoModule } from './modules/demo/demo.module'
import { DependencyModule } from './modules/dependency/dependency.module'
import { FeedModule } from './modules/feed/feed.module'
import { FileModule } from './modules/file/file.module'
import { HealthModule } from './modules/health/health.module'
import { HelperModule as BizHelperModule } from './modules/helper/helper.module'
import { InitModule } from './modules/init/init.module'
import { LinkModule } from './modules/link/link.module'
import { MarkdownModule } from './modules/markdown/markdown.module'
import { NoteModule } from './modules/note/note.module'
import { OptionModule } from './modules/option/option.module'
import { PageModule } from './modules/page/page.module'
import { PageProxyModule } from './modules/pageproxy/pageproxy.module'
import { PostModule } from './modules/post/post.module'
import { ProjectModule } from './modules/project/project.module'
import { PTYModule } from './modules/pty/pty.module'
import { RecentlyModule } from './modules/recently/recently.module'
import { RenderEjsModule } from './modules/render/render.module'
import { SayModule } from './modules/say/say.module'
import { SearchModule } from './modules/search/search.module'
import { ServerlessModule } from './modules/serverless/serverless.module'
import { SitemapModule } from './modules/sitemap/sitemap.module'
import { SnippetModule } from './modules/snippet/snippet.module'
import { SubscribeModule } from './modules/subscribe/subscribe.module'
import { TopicModule } from './modules/topic/topic.module'
import { UpdateModule } from './modules/update/update.module'
import { UserModule } from './modules/user/user.module'
import { DatabaseModule } from './processors/database/database.module'
import { GatewayModule } from './processors/gateway/gateway.module'
import { HelperModule } from './processors/helper/helper.module'
import { LoggerModule } from './processors/logger/logger.module'
import { RedisModule } from './processors/redis/redis.module'

@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    RedisModule,

    // biz module
    AggregateModule,
    AnalyzeModule,
    AuthModule,
    BackupModule,
    BizHelperModule,
    CategoryModule,
    CommentModule,
    ConfigsModule,
    DEMO_MODE && DemoModule,
    DependencyModule,
    FeedModule,
    FileModule,
    HealthModule,
    LinkModule,
    MarkdownModule,
    NoteModule,
    OptionModule,
    PageModule,
    PostModule,
    ProjectModule,
    PTYModule,
    RecentlyModule,
    SayModule,
    SearchModule,
    ServerlessModule,
    SitemapModule,
    SnippetModule,
    SubscribeModule,
    TopicModule,
    UpdateModule,
    UserModule,

    PageProxyModule,
    RenderEjsModule,
    // end biz

    GatewayModule,
    HelperModule,

    isDev && DebugModule,
  ].filter(Boolean) as Type<NestModule>[],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: DbQueryInterceptor,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor, // 5
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AnalyzeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CountingInterceptor, // 4
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: JSONTransformInterceptor, // 3
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseFilterInterceptor, // 2
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor, // 1
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotenceInterceptor, // 0
    },

    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  static register(isInit: boolean): DynamicModule {
    return {
      module: AppModule,
      imports: [!isInit && InitModule].filter(Boolean) as Type<NestModule>[],
    }
  }
}
