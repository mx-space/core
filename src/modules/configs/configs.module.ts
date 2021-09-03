/*
 * @Author: Innei
 * @Date: 2020-05-08 17:02:08
 * @LastEditTime: 2020-09-09 13:36:59
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/common/global/configs/configs.module.ts
 * @Copyright
 */

import { Global, Module } from '@nestjs/common'
import { ConfigsService } from './configs.service'

@Global()
@Module({
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ConfigsModule {}
