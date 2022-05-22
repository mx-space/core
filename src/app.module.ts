import { MiddlewareConsumer, Module, NestModule, Type } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'

import { AppController } from './app.controller'
import { AllExceptionsFilter } from './common/filters/any-exception.filter'
import { RolesGuard } from './common/guard/roles.guard'
import { AnalyzeInterceptor } from './common/interceptors/analyze.interceptor'
import { HttpCacheInterceptor } from './common/interceptors/cache.interceptor'
import { CountingInterceptor } from './common/interceptors/counting.interceptor'
import { JSONSerializeInterceptor } from './common/interceptors/json-serialize.interceptor'
import { QueryInterceptor } from './common/interceptors/query.interceptor'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { AttachHeaderTokenMiddleware } from './common/middlewares/attach-auth.middleware'
import { AggregateModule } from './modules/aggregate/aggregate.module'
import { AnalyzeModule } from './modules/analyze/analyze.module'
import { AuthModule } from './modules/auth/auth.module'
import { BackupModule } from './modules/backup/backup.module'
import { CategoryModule } from './modules/category/category.module'
import { CommentModule } from './modules/comment/comment.module'
import { ConfigsModule } from './modules/configs/configs.module'
import { DebugModule } from './modules/debug/debug.module'
import { FeedModule } from './modules/feed/feed.module'
import { FileModule } from './modules/file/file.module'
import { HealthModule } from './modules/health/health.module'
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
import { SayModule } from './modules/say/say.module'
import { SearchModule } from './modules/search/search.module'
import { ServerlessModule } from './modules/serverless/serverless.module'
import { SitemapModule } from './modules/sitemap/sitemap.module'
import { SnippetModule } from './modules/snippet/snippet.module'
import { ToolModule } from './modules/tool/tool.module'
import { TopicModule } from './modules/topic/topic.module'
import { UserModule } from './modules/user/user.module'
import { CacheModule } from './processors/cache/cache.module'
import { DatabaseModule } from './processors/database/database.module'
import { GatewayModule } from './processors/gateway/gateway.module'
import { HelperModule } from './processors/helper/helper.module'
import { LoggerModule } from './processors/logger/logger.module'

@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    CacheModule,

    AggregateModule,
    AnalyzeModule,
    AuthModule,
    BackupModule,
    CategoryModule,
    CommentModule,
    ConfigsModule,
    FeedModule,
    FileModule,
    HealthModule,
    InitModule,
    LinkModule,
    MarkdownModule,
    NoteModule,
    OptionModule,
    PageModule,
    PostModule,
    ProjectModule,
    PTYModule,
    RecentlyModule,
    TopicModule,
    SayModule,
    SearchModule,
    ServerlessModule,
    SitemapModule,
    SnippetModule,
    ToolModule,
    UserModule,

    PageProxyModule,

    GatewayModule,
    HelperModule,

    isDev ? DebugModule : undefined,
  ].filter(Boolean) as Type<NestModule>[],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: QueryInterceptor,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor, // 4
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AnalyzeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CountingInterceptor, // 3
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: JSONSerializeInterceptor, // 2
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor, // 1
    },

    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AttachHeaderTokenMiddleware).forRoutes('*')
  }
}
