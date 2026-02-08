import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type {
  BetterAuthSession,
  BetterAuthSessionResult,
  BetterAuthSignInResult,
  CheckLoggedResult,
  OwnerAllowLoginResult,
  OwnerSessionResult,
  UserModel,
} from '~/models/user'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    owner: UserController<ResponseWrapper>
  }
}

export class UserController<ResponseWrapper> implements IController {
  constructor(private readonly client: HTTPClient) {
    autoBind(this)
  }

  base = 'owner'

  name = ['owner']

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  private get authProxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy('auth')
  }

  private normalizeToken(token?: string) {
    const normalized = token?.trim()
    if (!normalized) {
      return undefined
    }
    return normalized.replace(/^bearer\s+/i, '')
  }

  /**
   * @deprecated Use `getOwnerInfo()` instead.
   */
  getMasterInfo() {
    return this.getOwnerInfo()
  }

  getOwnerInfo() {
    return this.proxy.get<UserModel>()
  }

  login(
    username: string,
    password: string,
    options?: {
      callbackURL?: string
      rememberMe?: boolean
    },
  ) {
    return this.authProxy('sign-in').username.post<BetterAuthSignInResult>({
      data: {
        username,
        password,
        ...options,
      },
    })
  }

  logout() {
    return this.authProxy('sign-out').post<{ success: boolean }>()
  }

  /**
   * Better Auth raw session (`/auth/get-session`).
   */
  getAuthSession(options?: {
    disableCookieCache?: boolean
    disableRefresh?: boolean
  }) {
    return this.authProxy('get-session').get<BetterAuthSessionResult | null>({
      params: options,
    })
  }

  /**
   * Core session summary (`/auth/session`).
   */
  getSession() {
    return this.authProxy.session.get<OwnerSessionResult | null>()
  }

  getProviders() {
    return this.authProxy.providers.get<string[]>()
  }

  getAllowLoginMethods() {
    return this.proxy('allow-login').get<OwnerAllowLoginResult>()
  }

  listSessions() {
    return this.authProxy('list-sessions').get<BetterAuthSession[]>()
  }

  revokeSession(token: string) {
    return this.authProxy('revoke-session').post<{ status: boolean }>({
      data: {
        token,
      },
    })
  }

  revokeSessions() {
    return this.authProxy('revoke-sessions').post<{ status: boolean }>()
  }

  revokeOtherSessions() {
    return this.authProxy('revoke-other-sessions').post<{ status: boolean }>()
  }

  checkTokenValid(token?: string) {
    const normalized = this.normalizeToken(token)

    return this.proxy.check_logged.get<CheckLoggedResult>({
      params: normalized ? { token: normalized } : undefined,
    })
  }
}
