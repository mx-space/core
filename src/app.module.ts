import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { AppController } from './app.controller'
import { HttpCacheInterceptor } from './common/interceptors/cache.interceptor'
import { AnalyzeMiddleware } from './common/middlewares/analyze.middleware'
import { SkipBrowserDefaultRequestMiddleware } from './common/middlewares/favicon.middleware'
import { SecurityMiddleware } from './common/middlewares/security.middleware'
import { AuthModule } from './modules/auth/auth.module'
// must after post
import { CategoryModule } from './modules/category/category.module'
import { InitModule } from './modules/init/init.module'
import { PostModule } from './modules/post/post.module'
import { UserModule } from './modules/user/user.module'
import { CacheModule } from './processors/cache/cache.module'
import { DbModule } from './processors/database/database.module'
import { GatewayModule } from './processors/gateway/gateway.module'
import { HelperModule } from './processors/helper/helper.module'

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

    InitModule,
    UserModule,
    PostModule,
    CategoryModule,
    AuthModule,
    UserModule,

    GatewayModule,
    HelperModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
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
