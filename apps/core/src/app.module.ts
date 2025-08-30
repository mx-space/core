import { LoggerModule } from '@innei/pretty-logger-nestjs'
import type {
  DynamicModule,
  MiddlewareConsumer,
  NestModule,
  Type,
} from '@nestjs/common'
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AppController } from './app.controller'
import { AllExceptionsFilter } from './common/filters/any-exception.filter'
import { RolesGuard } from './common/guards/roles.guard'
import { ExtendThrottlerGuard } from './common/guards/throttler.guard'
import { AnalyzeInterceptor } from './common/interceptors/analyze.interceptor'
import { HttpCacheInterceptor } from './common/interceptors/cache.interceptor'
import { DbQueryInterceptor } from './common/interceptors/db-query.interceptor'
import { IdempotenceInterceptor } from './common/interceptors/idempotence.interceptor'
import { JSONTransformInterceptor } from './common/interceptors/json-transform.interceptor'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { RequestContextMiddleware } from './common/middlewares/request-context.middleware'
import { AckModule } from './modules/ack/ack.module'
import { ActivityModule } from './modules/activity/activity.module'
import { AggregateModule } from './modules/aggregate/aggregate.module'
import { AiModule } from './modules/ai/ai.module'
import { AnalyzeModule } from './modules/analyze/analyze.module'
import { AuthModule } from './modules/auth/auth.module'
import { AuthnModule } from './modules/authn/auth.module'
import { BackupModule } from './modules/backup/backup.module'
import { CategoryModule } from './modules/category/category.module'
import { CommentModule } from './modules/comment/comment.module'
import { ConfigsModule } from './modules/configs/configs.module'
import { DebugModule } from './modules/debug/debug.module'
import { DependencyModule } from './modules/dependency/dependency.module'
import { FeedModule } from './modules/feed/feed.module'
import { FileModule } from './modules/file/file.module'
import { HealthModule } from './modules/health/health.module'
import { HelperModule as BizHelperModule } from './modules/helper/helper.module'
import { InitModule } from './modules/init/init.module'
import { LinkModule } from './modules/link/link.module'
import { MarkdownModule } from './modules/markdown/markdown.module'
import { McpModule } from './modules/mcp/mcp.module'
import { NoteModule } from './modules/note/note.module'
import { OptionModule } from './modules/option/option.module'
import { PageModule } from './modules/page/page.module'
import { PageProxyModule } from './modules/pageproxy/pageproxy.module'
import { PostModule } from './modules/post/post.module'
import { ProjectModule } from './modules/project/project.module'
import { ReaderModule } from './modules/reader/reader.module'
import { RecentlyModule } from './modules/recently/recently.module'
import { RenderEjsModule } from './modules/render/render.module'
import { SayModule } from './modules/say/say.module'
import { SearchModule } from './modules/search/search.module'
import { ServerTimeModule } from './modules/server-time/server-time.module'
import { ServerlessModule } from './modules/serverless/serverless.module'
import { SitemapModule } from './modules/sitemap/sitemap.module'
import { SlugTrackerModule } from './modules/slug-tracker/slug-tracker.module'
import { SnippetModule } from './modules/snippet/snippet.module'
import { SubscribeModule } from './modules/subscribe/subscribe.module'
import { TopicModule } from './modules/topic/topic.module'
import { UpdateModule } from './modules/update/update.module'
import { UserModule } from './modules/user/user.module'
import { WebhookModule } from './modules/webhook/webhook.module'
import { DatabaseModule } from './processors/database/database.module'
import { GatewayModule } from './processors/gateway/gateway.module'
import { HelperModule } from './processors/helper/helper.module'
import { RedisModule } from './processors/redis/redis.module'

@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    RedisModule,

    // biz module
    AiModule,
    AckModule,
    ActivityModule,
    AggregateModule,
    AnalyzeModule,
    AuthModule.forRoot(),
    AuthnModule,
    BackupModule,
    BizHelperModule,
    CategoryModule,
    CommentModule,
    ConfigsModule,

    DependencyModule,
    FeedModule,
    FileModule,
    HealthModule,
    LinkModule,
    MarkdownModule,
    McpModule,
    NoteModule,
    OptionModule,
    PageModule,
    PostModule,
    ProjectModule,
    RecentlyModule,
    ReaderModule,
    SayModule,
    SearchModule,
    ServerlessModule,
    ServerTimeModule,
    SitemapModule,
    SlugTrackerModule,
    SnippetModule,
    SubscribeModule,
    TopicModule,
    UpdateModule,
    UserModule,
    WebhookModule,

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
      useClass: AnalyzeInterceptor,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: JSONTransformInterceptor,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotenceInterceptor,
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
      useClass: ExtendThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  static register(isInit: boolean): DynamicModule {
    return {
      module: AppModule,
      imports: [!isInit && InitModule].filter(Boolean) as Type<NestModule>[],
    }
  }
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*app')
  }
}
