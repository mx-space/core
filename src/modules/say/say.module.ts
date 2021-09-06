import { Module } from '@nestjs/common'
import { SayController } from './say.controller'

@Module({ controllers: [SayController] })
export class SayModule {}
