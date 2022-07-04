import { readFile } from 'fs/promises'
import { Observable } from 'rxjs'

import { BadRequestException, Get, Query, Sse } from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { DATA_DIR } from '~/constants/path.constant'
import { CacheService } from '~/processors/redis/cache.service'
import { getRedisKey, installPKG } from '~/utils'

@ApiController('dependencies')
@Auth()
export class DependencyController {
  constructor(private readonly redisService: CacheService) {}

  @Get('/graph')
  async getDependencyGraph() {
    return (
      JSON.safeParse(
        await readFile(path.join(DATA_DIR, 'package.json'), 'utf8'),
      )?.dependencies || {}
    )
  }

  @Sse('/install_deps')
  async installDepsPty(@Query() query: any): Promise<Observable<string>> {
    const { id } = query

    if (!id) {
      throw new BadRequestException('id is required')
    }

    const packageNames = await this.redisService
      .getClient()
      .hget(getRedisKey(RedisKeys.DependencyQueue), id)

    if (!packageNames) {
      throw new BadRequestException('can not get this task')
    }
    // const packageNames = 'axios vue'

    const pty = await installPKG(packageNames, DATA_DIR)
    const observable = new Observable<string>((subscriber) => {
      pty.onData((data) => {
        subscriber.next(data)
      })

      pty.onExit(async ({ exitCode }) => {
        if (exitCode != 0) {
          subscriber.next(`Error: Exit code: ${exitCode}`)
        }

        subscriber.next('任务完成，可关闭此窗口。')
        subscriber.complete()
        await this.redisService
          .getClient()
          .hdel(getRedisKey(RedisKeys.DependencyQueue), id)
      })
    })

    return observable
  }
}
