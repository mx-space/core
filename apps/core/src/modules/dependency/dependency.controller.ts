import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Observable } from 'rxjs'

import { chalk } from '@mx-space/compiled'
import { BadRequestException, Get, Query, Sse } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { DATA_DIR } from '~/constants/path.constant'
import { installPKG } from '~/utils/system.util'

import { ServerlessService } from '../serverless/serverless.service'

@ApiController('dependencies')
@Auth()
export class DependencyController {
  constructor(private readonly servierlessService: ServerlessService) {}

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
