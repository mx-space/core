import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { Get, Query, Sse } from '@nestjs/common'
import pc from 'picocolors'
import { Observable } from 'rxjs'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { RawResponse } from '~/common/response/raw-response.decorator'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
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
  @RawResponse
  async installDepsPty(@Query() query: any): Promise<Observable<string>> {
    const { packageNames } = query

    if (typeof packageNames !== 'string') {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'packageNames must be string',
      )
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
        subscriber.next(pc.green('任务完成，可关闭此窗口。'))
        subscriber.complete()
      })
    })
  }
}
