import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { InitModule } from './modules/init/init.module'
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [InitModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
