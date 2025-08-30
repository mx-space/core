import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { TLogin, UserModel } from '~/models/user'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    user: UserController<ResponseWrapper>
    master: UserController<ResponseWrapper>
  }
}

export class UserController<ResponseWrapper> implements IController {
  constructor(private readonly client: HTTPClient) {
    autoBind(this)
  }

  base = 'master'

  name = ['user', 'master']

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  getMasterInfo() {
    return this.proxy.get<UserModel>()
  }

  login(username: string, password: string) {
    return this.proxy.login.post<TLogin>({
      data: {
        username,
        password,
      },
    })
  }

  loginWithToken(token?: string) {
    return this.proxy.login.put<{ token: string }>({
      params: token
        ? {
            token: `bearer ${token.replace(/^bearer\s/i, '')}`,
          }
        : undefined,
    })
  }

  checkTokenValid(token: string) {
    return this.proxy.check_logged.get<{ ok: number; isGuest: boolean }>({
      params: {
        token: `bearer ${token.replace(/^bearer\s/i, '')}`,
      },
    })
  }
}
