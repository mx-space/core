// THIS MODULE IS DISABLED
// @ts-nocheck
import { isNil, pick } from 'lodash'
import { spawn } from 'node-pty'
import { Socket } from 'socket.io'

import { nanoid as N } from '@mx-space/external'
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets'

import { DEMO_MODE } from '~/app.config'
import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { DATA_DIR } from '~/constants/path.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { createAuthGateway } from '~/processors/gateway/shared/auth.gateway'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { CacheService } from '~/processors/redis/cache.service'
import { getIp, getRedisKey } from '~/utils'
import type { IPty } from 'node-pty'
import type {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'

const { nanoid } = N

const AuthGateway = createAuthGateway({ namespace: 'pty', authway: 'jwt' })
@WebSocketGateway<GatewayMetadata>({ namespace: 'pty' })
export class PTYGateway
  extends AuthGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    protected readonly jwtService: JWTService,
    protected readonly authService: AuthService,
    protected readonly cacheService: CacheService,
    protected readonly configService: ConfigsService,
  ) {
    super(jwtService, authService)
  }
  socket2ptyMap = new WeakMap<Socket, IPty>()

  @SubscribeMessage('pty')
  async pty(
    client: Socket,
    data?: { password?: string; cols: number; rows: number },
  ) {
    if (DEMO_MODE) {
      client.send(
        this.gatewayMessageFormat(
          BusinessEvents.PTY_MESSAGE,
          'PTY 在演示模式下不可用',
        ),
      )

      return
    }

    const password = data?.password
    const terminalOptions = await this.configService.get('terminalOptions')
    if (!terminalOptions.enable) {
      client.send(
        this.gatewayMessageFormat(BusinessEvents.PTY_MESSAGE, 'PTY 已禁用'),
      )

      return
    }

    const isValidPassword = isNil(terminalOptions.password)
      ? true
      : password === terminalOptions.password

    if (!isValidPassword) {
      if (typeof password === 'undefined' || password === '') {
        client.send(
          this.gatewayMessageFormat(
            BusinessEvents.PTY_MESSAGE,
            'PTY 验证未通过：需要密码验证',
            10000,
          ),
        )
      } else {
        client.send(
          this.gatewayMessageFormat(
            BusinessEvents.PTY_MESSAGE,
            'PTY 验证未通过：密码错误',
            10001,
          ),
        )
      }

      return
    }
    const zsh = await $`zsh --version`.quiet().nothrow()
    const fish = await $`fish --version`.quiet().nothrow()

    const pty = spawn(
      os.platform() === 'win32'
        ? 'powershell.exe'
        : zsh.exitCode == 0
          ? 'zsh'
          : fish.exitCode == 0
            ? 'fish'
            : 'bash',
      [],
      {
        cwd: DATA_DIR,
        cols: data?.cols || 30,
        rows: data?.rows || 80,
        env: pick(process.env, [
          'PATH',
          'EDITOR',
          'SHELL',
          'USER',
          'VISUAL',
          'LANG',
          'TERM',
          'LANGUAGE',

          // other
          'N_PREFIX',
          'N_PRESERVE_NPM',
        ]) as any,
      },
    )

    const nid = nanoid()
    const ip =
      client.handshake.headers['x-forwarded-for'] ||
      client.handshake.address ||
      getIp(client.request) ||
      client.conn.remoteAddress

    this.cacheService.getClient().hset(
      getRedisKey(RedisKeys.PTYSession),
      nid,

      `${new Date().toISOString()},${ip}`,
    )
    pty.onExit(async () => {
      const hvalue = await this.cacheService
        .getClient()
        .hget(getRedisKey(RedisKeys.PTYSession), nid)
      if (hvalue) {
        this.cacheService
          .getClient()
          .hset(
            getRedisKey(RedisKeys.PTYSession),
            nid,
            `${hvalue},${new Date().toISOString()}`,
          )
      }
    })

    if (terminalOptions.script) {
      pty.write(terminalOptions.script)
      pty.write('\n')
    }
    pty.onData((data) => {
      client.send(this.gatewayMessageFormat(BusinessEvents.PTY, data))
    })

    this.socket2ptyMap.set(client, pty)
  }

  @SubscribeMessage('pty-input')
  async ptyInput(client: Socket, data: string) {
    const pty = this.socket2ptyMap.get(client)
    if (pty) {
      pty.write(data)
    }
  }

  @SubscribeMessage('pty-exit')
  async ptyExit(client: Socket) {
    const pty = this.socket2ptyMap.get(client)
    if (pty) {
      pty.kill()
    }
    this.socket2ptyMap.delete(client)
  }

  handleDisconnect(client: Socket) {
    this.ptyExit(client)
    super.handleDisconnect(client)
  }
}
