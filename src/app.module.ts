import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { HelperModule } from './modules/helper/helper.module'
import { InitModule } from './modules/init/init.module'
import { PostModule } from './modules/post/post.module'
// must after post
import { CategoryModule } from './modules/category/category.module'
import { UserModule } from './modules/user/user.module'

@Module({
  imports: [
    InitModule,
    UserModule,
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
    HelperModule,
    PostModule,
    CategoryModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
