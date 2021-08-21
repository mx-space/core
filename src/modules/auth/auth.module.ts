import { HttpModule, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'
import { LocalStrategy } from './local.strategy'
import { AuthController } from './auth.controller'
import { AdminEventsGateway } from '../../processors/gateway/admin/events.gateway'

const jwtModule = JwtModule.registerAsync({
  useFactory() {
    return {
      secret: process.env.SECRET || 'asdhaisouxcjzuoiqdnasjduw',
      signOptions: {
        expiresIn: '7d',
      },
    }
  },
})
@Module({
  imports: [PassportModule, jwtModule, HttpModule],
  providers: [AuthService, JwtStrategy, LocalStrategy, AdminEventsGateway],
  controllers: [AuthController],
  exports: [JwtStrategy, LocalStrategy, AuthService, jwtModule],
})
export class AuthModule {}
