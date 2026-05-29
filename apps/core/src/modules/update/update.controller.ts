import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { Query, Sse } from '@nestjs/common'
import pc from 'picocolors'
import { catchError, Observable } from 'rxjs'
import { lt, major, minor } from 'semver'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { resolveAdminAssetRoot } from '~/constants/path.constant'
import { isDev } from '~/global/env.global'
import { isSemVer } from '~/utils/validator.util'

import { UpdateAdminDto } from './update.schema'
import { UpdateService } from './update.service'

@ApiController('update')
@Auth()
export class UpdateController {
  constructor(private readonly service: UpdateService) {}

  @Sse('/upgrade/dashboard')
  @HTTPDecorators.Idempotence()
  @HTTPDecorators.RawResponse
  async updateDashboard(
    @Query() query: UpdateAdminDto,
  ): Promise<Observable<string>> {
    const { force = false } = query

    const sseOutput$ = new Observable<string>((observer) => {
      const pipeStream = (stream$: Observable<string>) =>
        new Promise<void>((resolve) => {
          stream$.subscribe({
            next: (data) => observer.next(data),
            complete: () => resolve(),
            error: () => resolve(),
          })
        })

      const run = async () => {
        let currentVersion = '0.0.0'

        const adminAssetRoot = resolveAdminAssetRoot('index.html')
        const isExistLocalAdmin = existsSync(
          path.join(adminAssetRoot, 'index.html'),
        )

        if (!isExistLocalAdmin) {
          await pipeStream(
            this.service.startClusterAdminAssetUpdate(currentVersion),
          )
          observer.complete()
          return
        }

        const versionPath = path.resolve(adminAssetRoot, 'version')
        if (existsSync(versionPath)) {
          let versionInfo: string
          try {
            const data = await readFile(versionPath, { encoding: 'utf8' })
            versionInfo = data.split('\n')[0]
          } catch {
            versionInfo = ''
          }
          if (isSemVer(versionInfo)) {
            currentVersion = versionInfo
          }
        }

        let latestVersion: string
        try {
          latestVersion = await this.service.getLatestAdminVersion()
        } catch (error: any) {
          observer.next(
            pc.red(`Fetching latest admin version error: ${error.message}\n`),
          )
          observer.complete()
          return
        }

        if (!lt(currentVersion, latestVersion)) {
          observer.next(pc.green(`Admin dashboard is up to date.\n`))
          observer.complete()
          return
        }
        const isCrossVersion =
          minor(currentVersion) !== minor(latestVersion) ||
          major(currentVersion) !== major(latestVersion)
        if (!force && !isDev && isCrossVersion) {
          observer.next(
            pc.red(
              `The latest version is ${latestVersion}, current version is ${currentVersion}, can not cross-version upgrade.\n`,
            ),
          )
          observer.complete()
          return
        }

        await pipeStream(
          this.service.startClusterAdminAssetUpdate(latestVersion),
        )
        observer.complete()
      }

      void run()
    })

    return sseOutput$.pipe(
      catchError((err) => {
        console.error(err)
        return sseOutput$
      }),
    )
  }
}
