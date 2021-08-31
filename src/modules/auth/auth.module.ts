import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AdminEventsGateway } from '../../processors/gateway/admin/events.gateway'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'

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
  imports: [PassportModule, jwtModule],
  providers: [AuthService, JwtStrategy, AdminEventsGateway],
  controllers: [AuthController],
  exports: [JwtStrategy, AuthService, jwtModule],
})
export class AuthModule {}
