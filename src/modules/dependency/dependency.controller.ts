import { readFile } from 'fs/promises'
import { Observable } from 'rxjs'

import { BadRequestException, Get, Query, Sse } from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { DATA_DIR } from '~/constants/path.constant'
import { installPKG } from '~/utils'

@ApiController('dependencies')
@Auth()
@ApiName
export class DependencyController {
  constructor() {}

  @Get('/graph')
  @HTTPDecorators.Bypass
  async getDependencyGraph() {
    return {
      dependencies:
        JSON.safeParse(
          await readFile(path.join(DATA_DIR, 'package.json'), 'utf8'),
        )?.dependencies || {},
    }
  }

  @Sse('/install_deps')
  async installDepsPty(@Query() query: any): Promise<Observable<string>> {
    const { packageNames } = query

    if (typeof packageNames != 'string') {
      throw new BadRequestException('packageNames must be string')
    }

    const pty = await installPKG(packageNames.split(',').join(' '), DATA_DIR)
    const observable = new Observable<string>((subscriber) => {
      pty.onData((data) => {
        subscriber.next(data)
      })

      pty.onExit(async ({ exitCode }) => {
        if (exitCode != 0) {
          subscriber.next(chalk.red(`Error: Exit code: ${exitCode}\n`))
        }

        subscriber.next(chalk.green('任务完成，可关闭此窗口。'))
        subscriber.complete()
      })
    })

    return observable
  }
}
