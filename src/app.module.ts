import { Module, OnModuleInit } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { InitModule } from './modules/init/init.module'
import { UserModule } from './modules/user/user.module'
import { HelperModule } from './modules/helper/helper.module'
import { PostModule } from './modules/post/post.module';
import { CategoryModule } from './modules/category/category.module';

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
