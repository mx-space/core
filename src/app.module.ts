import {
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { GraphQLModule } from '@nestjs/graphql'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { AppController } from './app.controller'
import { AppResolver } from './app.resolver'
import { AllExceptionsFilter } from './common/filters/any-exception.filter'
import { RolesGuard } from './common/guard/roles.guard'
import { HttpCacheInterceptor } from './common/interceptors/cache.interceptor'
import { CountingInterceptor } from './common/interceptors/counting.interceptor'
import {
  JSONSerializeInterceptor,
  ResponseInterceptor,
} from './common/interceptors/response.interceptors'
import { AnalyzeMiddleware } from './common/middlewares/analyze.middleware'
import { SkipBrowserDefaultRequestMiddleware } from './common/middlewares/favicon.middleware'
import { SecurityMiddleware } from './common/middlewares/security.middleware'
import {
  ASSET_DIR,
  DATA_DIR,
  LOGGER_DIR,
  TEMP_DIR,
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

// FIXME
function mkdirs() {
  mkdirSync(DATA_DIR, { recursive: true })
  Logger.log(chalk.blue('数据目录已经建好: ' + DATA_DIR))
  mkdirSync(TEMP_DIR, { recursive: true })
  Logger.log(chalk.blue('临时目录已经建好: ' + TEMP_DIR))
  mkdirSync(LOGGER_DIR, { recursive: true })
  Logger.log(chalk.blue('日志目录已经建好: ' + LOGGER_DIR))
  mkdirSync(ASSET_DIR, { recursive: true })
  Logger.log(chalk.blue('资源目录已经建好: ' + ASSET_DIR))
}
mkdirs()

@Module({
  imports: [
    DbModule,
    CacheModule,
    ConfigModule.forRoot({
      envFilePath: [
        '.env.development.local',
        '.env.development',
        '.env.production.local',
        '.env.production',
        '.env',
      ],
      isGlobal: true,
    }),
    GraphQLModule.forRoot({
      debug: isDev,
      playground: isDev,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      context: ({ req }) => ({ req }),
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
    consumer
      .apply(AnalyzeMiddleware)
      .forRoutes({ path: '(.*?)', method: RequestMethod.GET })
      .apply(SkipBrowserDefaultRequestMiddleware, SecurityMiddleware)
      .forRoutes({ path: '(.*?)', method: RequestMethod.ALL })
  }
}
