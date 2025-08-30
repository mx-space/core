import type { ExecutionContext } from '@nestjs/common'
import { UnauthorizedException } from '@nestjs/common'
import type { UserModel } from '~/modules/user/user.model'
import { authJWTToken } from '../constants/token'

export const mockUser1: UserModel = {
  id: '1',
  name: 'John Doe',
  mail: 'example@ee.com',
  password: '**********',

  username: 'johndoe',
  created: new Date('2021/1/1 10:00:11'),
}

export class AuthTestingGuard {
  async canActivate(context: ExecutionContext): Promise<any> {
    const req = context.switchToHttp().getRequest()

    if (req.headers['test-token']) {
      req.user = {
        ...mockUser1,
      }
      req.token = authJWTToken
      req.isAuthenticated = true

      return true
    }

    throw new UnauthorizedException()
  }
}

export const authPassHeader = {
  'test-token': 1,
}
