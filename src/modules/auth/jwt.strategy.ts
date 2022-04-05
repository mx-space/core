/*
 * @Author: Innei
 * @Date: 2020-04-30 12:21:51
 * @LastEditTime: 2020-07-31 19:52:35
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/auth/jwt.strategy.ts
 * @Coding with Love
 */
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt'

import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'

import { __secret } from './auth.module'
import { AuthService } from './auth.service'
import { JwtPayload } from './interfaces/jwt-payload.interface'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: __secret,
      ignoreExpiration: false,
    } as StrategyOptions)
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.verifyPayload(payload)
    if (user) {
      return user
    }
    throw new UnauthorizedException('身份已过期')
  }
}
