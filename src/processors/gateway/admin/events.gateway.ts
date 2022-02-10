import { OnEvent } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Emitter } from '@socket.io/redis-emitter'
import { isNil } from 'lodash'
import { IPty, spawn } from 'node-pty'
import { resolve } from 'path'
import SocketIO, { Socket } from 'socket.io'
import { EventBusEvents } from '~/constants/event.constant'
import { LOG_DIR } from '~/constants/path.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { CacheService } from '~/processors/cache/cache.service'
import { getTodayLogFilePath } from '~/utils/consola.util'
import { AuthService } from '../../../modules/auth/auth.service'
import { BaseGateway } from '../base.gateway'
import { EventTypes } from '../events.types'

@WebSocketGateway<GatewayMetadata>({ namespace: 'admin' })
export class AdminEventsGateway
  extends BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigsService,
  ) {
    super()
  }

  tokenSocketIdMap = new Map<string, string>()

  @WebSocketServer()
  private namespace: SocketIO.Namespace

  async authFailed(client: SocketIO.Socket) {
    client.send(this.gatewayMessageFormat(EventTypes.AUTH_FAILED, '认证失败'))
    client.disconnect()
  }

  async authToken(token: string): Promise<boolean> {
    if (typeof token !== 'string') {
      return false
    }
    // first check this token is custom token in user
    const verifyCustomToken = await this.authService.verifyCustomToken(token)
    if (verifyCustomToken) {
      return true
    } else {
      // if not, then verify jwt token
      try {
        const payload = this.jwtService.verify(token)
        const user = await this.authService.verifyPayload(payload)
        if (!user) {
          return false
        }
      } catch {
        return false
      }
      // is not crash, is verify
      return true
    }
  }
  async handleConnection(client: SocketIO.Socket) {
    const token =
      client.handshake.query.token || client.handshake.headers['authorization']

    if (!(await this.authToken(token as string))) {
      return this.authFailed(client)
    }

    super.handleConnect(client)

    const sid = client.id
    this.tokenSocketIdMap.set(token.toString(), sid)
  }

  subscribeSocketToHandlerMap = new WeakMap<Socket, Function>()

  @SubscribeMessage('log')
  async subscribeStdOut(client: Socket) {
    if (this.subscribeSocketToHandlerMap.has(client)) {
      return
    }

    const handler = (data) => {
      client.send(this.gatewayMessageFormat(EventTypes.STDOUT, data))
    }

    this.subscribeSocketToHandlerMap.set(client, handler)

    const stream = fs
      .createReadStream(resolve(LOG_DIR, getTodayLogFilePath()), {
        encoding: 'utf-8',
        highWaterMark: 32 * 1024,
      })
      .on('data', handler)
      .on('end', () => {
        this.cacheService.subscribe('log', handler)
        stream.close()
      })
  }

  @SubscribeMessage('unlog')
  unsubscribeStdOut(client: Socket) {
    const cb = this.subscribeSocketToHandlerMap.get(client)
    if (cb) {
      this.cacheService.unsubscribe('log', cb as any)
    }
    this.subscribeSocketToHandlerMap.delete(client)
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
        this.gatewayMessageFormat(EventTypes.PTY_MESSAGE, 'PTY 已禁用'),
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
            EventTypes.PTY_MESSAGE,
            'PTY 验证未通过：需要密码验证',
            10000,
          ),
        )
      } else {
        client.send(
          this.gatewayMessageFormat(
            EventTypes.PTY_MESSAGE,
            'PTY 验证未通过：密码错误',
            10001,
          ),
        )
      }

      return
    }
    const zsh = await nothrow($`zsh --version`)

    const pty = spawn(
      os.platform() === 'win32'
        ? 'powershell.exe'
        : zsh.exitCode == 0
        ? 'zsh'
        : 'bash',
      [],
      {
        cwd: os.homedir(),
        cols: data?.cols || 30,
        rows: data?.rows || 80,
      },
    )

    pty.onData((data) => {
      client.send(this.gatewayMessageFormat(EventTypes.PTY, data))
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

  handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
    this.unsubscribeStdOut(client)
    this.ptyExit(client)
  }

  @OnEvent(EventBusEvents.TokenExpired)
  handleTokenExpired(token: string) {
    const server = this.namespace.server
    const sid = this.tokenSocketIdMap.get(token)

    const socket = server.of('/admin').sockets.get(sid)
    if (socket) {
      socket.disconnect()
      super.handleDisconnect(socket)
      return true
    }
    return false
  }

  broadcast(event: EventTypes, data: any) {
    const client = new Emitter(this.cacheService.getClient())
    client.of('/admin').emit('message', this.gatewayMessageFormat(event, data))
  }
}
