import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { InitModule } from './modules/init/init.module'

@Module({
  imports: [InitModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
