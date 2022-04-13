import { isNil } from 'lodash'
import { nanoid } from 'nanoid'
import { IPty, spawn } from 'node-pty'
import { Socket } from 'socket.io'

import { JwtService } from '@nestjs/jwt'
import {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'

import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { DATA_DIR } from '~/constants/path.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { CacheService } from '~/processors/cache/cache.service'
import { createAuthGateway } from '~/processors/gateway/shared/auth.gateway'
import { getIp, getRedisKey } from '~/utils'

const AuthGateway = createAuthGateway({ namespace: 'pty', authway: 'jwt' })
@WebSocketGateway<GatewayMetadata>({ namespace: 'pty' })
export class PTYGateway
  extends AuthGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    protected readonly jwtService: JwtService,
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
    const zsh = await nothrow($`zsh --version`)
    const fish = await nothrow($`fish --version`)

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
