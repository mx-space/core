import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { Get, Query, Sse } from '@nestjs/common'
import pc from 'picocolors'
import { Observable } from 'rxjs'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { DATA_DIR } from '~/constants/path.constant'
import { installPKG } from '~/utils/system.util'

@ApiController('dependencies')
@Auth()
export class DependencyController {
  @Get('/graph')
  async getDependencyGraph() {
    return {
      dependencies:
        JSON.safeParse(
          await readFile(path.join(DATA_DIR, 'package.json'), 'utf8'),
        )?.dependencies || {},
    }
  }

  @Sse('/install_deps')
  @HTTPDecorators.RawResponse
  async installDepsPty(@Query() query: any): Promise<Observable<string>> {
    const { packageNames } = query

    if (typeof packageNames !== 'string') {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'packageNames must be string',
      })
    }

    const pty = await installPKG(packageNames.split(',').join(' '), DATA_DIR)
    return new Observable<string>((subscriber) => {
      pty.onData((data) => {
        subscriber.next(data)
      })

      pty.onExit(({ exitCode }) => {
        if (exitCode !== 0) {
          subscriber.next(pc.red(`Error: Exit code: ${exitCode}\n`))
        }
        subscriber.next(pc.green('Task complete. You may close this window.'))
        subscriber.complete()
      })
    })
  }
}
