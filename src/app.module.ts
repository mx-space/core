import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { GraphQLModule } from '@nestjs/graphql'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { AppController } from './app.controller'
import { AppResolver } from './app.resolver'
import { AllExceptionsFilter } from './common/filters/any-exception.filter'
import { RolesGuard } from './common/guard/roles.guard'
import { AnalyzeInterceptor } from './common/interceptors/analyze.interceptor'
import { HttpCacheInterceptor } from './common/interceptors/cache.interceptor'
import { CountingInterceptor } from './common/interceptors/counting.interceptor'
import { JSONSerializeInterceptor } from './common/interceptors/json-serialize.interceptor'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import {
  DATA_DIR,
  LOGGER_DIR,
  TEMP_DIR,
  USER_ASSET_DIR,
} from './constants/path.constant'
import { AggregateModule } from './modules/aggregate/aggregate.module'
import { AnalyzeModule } from './modules/analyze/analyze.module'
import { AuthModule } from './modules/auth/auth.module'
import { BackupModule } from './modules/backup/backup.module'
import { CategoryModule } from './modules/category/category.module'
import { CommentModule } from './modules/comment/comment.module'
import { ConfigsModule } from './modules/configs/configs.module'
import { FeedModule } from './modules/feed/feed.module'
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
import { RecentlyModule } from './modules/recently/recently.module'
import { SayModule } from './modules/say/say.module'
import { SearchModule } from './modules/search/search.module'
import { SitemapModule } from './modules/sitemap/sitemap.module'
import { ToolModule } from './modules/tool/tool.module'
import { UserModule } from './modules/user/user.module'
import { CacheModule } from './processors/cache/cache.module'
import { DbModule } from './processors/database/database.module'
import { GatewayModule } from './processors/gateway/gateway.module'
import { HelperModule } from './processors/helper/helper.module'
import { LoggerModule } from './processors/logger/logger.module'

// FIXME
function mkdirs() {
  mkdirSync(DATA_DIR, { recursive: true })
  Logger.log(chalk.blue('数据目录已经建好: ' + DATA_DIR))
  mkdirSync(TEMP_DIR, { recursive: true })
  Logger.log(chalk.blue('临时目录已经建好: ' + TEMP_DIR))
  mkdirSync(LOGGER_DIR, { recursive: true })
  Logger.log(chalk.blue('日志目录已经建好: ' + LOGGER_DIR))
  mkdirSync(USER_ASSET_DIR, { recursive: true })
  Logger.log(chalk.blue('资源目录已经建好: ' + USER_ASSET_DIR))
}
mkdirs()

@Module({
  imports: [
    DbModule,
    CacheModule,

    GraphQLModule.forRoot({
      debug: isDev,
      playground: isDev,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      context: ({ req }) => ({ req }),
      cors: false,
    }),

    AggregateModule,
    AnalyzeModule,
    AuthModule,
    BackupModule,
    CategoryModule,
    CommentModule,
    ConfigsModule,
    FeedModule,
    HealthModule,
    InitModule,
    LinkModule,
    MarkdownModule,
    NoteModule,
    OptionModule,
    PageModule,
    PostModule,
    ProjectModule,
    RecentlyModule,
    SayModule,
    SearchModule,
    SitemapModule,
    ToolModule,
    UserModule,

    PageProxyModule,

    GatewayModule,
    HelperModule,
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [
    AppResolver,

    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AnalyzeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CountingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: JSONSerializeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
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
    // FIXME: nestjs 8 middleware bug
    // consumer
    //   .apply(AnalyzeMiddleware)
    //   .forRoutes({ path: '(.*?)', method: RequestMethod.GET })
    //   .apply(SkipBrowserDefaultRequestMiddleware, SecurityMiddleware)
    //   .forRoutes({ path: '(.*?)', method: RequestMethod.ALL })
  }
}
