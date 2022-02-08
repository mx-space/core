import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import cluster from 'cluster'
import { machineIdSync } from 'node-machine-id'
import { CLUSTER, SECURITY } from '~/app.config'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'

const getMachineId = () => {
  const id = machineIdSync()
  return id
}
export const __secret: any =
  SECURITY.jwtSecret ||
  Buffer.from(getMachineId()).toString('base64').slice(0, 15) ||
  'asjhczxiucipoiopiqm2376'

if (!CLUSTER.enable || cluster.isPrimary) {
  consola.log(
    'JWT Secret start with :',
    __secret.slice(0, 5) + '*'.repeat(__secret.length - 5),
  )
}

const jwtModule = JwtModule.registerAsync({
  useFactory() {
    return {
      secret: __secret,
      signOptions: {
        expiresIn: SECURITY.jwtExpire,
        algorithm: 'HS256',
      },
    }
  },
})
@Module({
  imports: [PassportModule, jwtModule],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtStrategy, AuthService, jwtModule],
})
export class AuthModule {}
