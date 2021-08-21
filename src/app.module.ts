import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
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
})
export class AppModule {}
