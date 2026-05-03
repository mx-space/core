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
import { PKG } from '~/utils/pkg.util'
import { isSemVer } from '~/utils/validator.util'

import { UpdateAdminDto } from './update.schema'
import { UpdateService } from './update.service'

@ApiController('update')
@Auth()
export class UpdateController {
  constructor(private readonly service: UpdateService) {}

  @Sse('/upgrade/dashboard')
  @HTTPDecorators.Idempotence()
  @HTTPDecorators.Bypass
  async updateDashboard(
    @Query() query: UpdateAdminDto,
  ): Promise<Observable<string>> {
    const { force = false } = query

    const sseOutput$ = new Observable<string>((observer) => {
      ;(async () => {
        // 1. check current local admin version if exist.
        let { version: currentVersion } = PKG.dashboard!

        const adminAssetRoot = resolveAdminAssetRoot('index.html')
        const isExistLocalAdmin = existsSync(
          path.join(adminAssetRoot, 'index.html'),
        )

        if (!isExistLocalAdmin) {
          const stream$ =
            this.service.startClusterAdminAssetUpdate(currentVersion)
          await new Promise<void>((resolve) => {
            stream$.subscribe({
              next: (data) => observer.next(data),
              complete: () => resolve(),
              error: () => resolve(),
            })
          })
          observer.complete()
          return
        }

        const versionPath = path.resolve(adminAssetRoot, 'version')
        const isHasVersion = existsSync(versionPath)
        if (isHasVersion) {
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

        // 3. fetch latest admin version
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
        if (
          !force &&
          !isDev &&
          (minor(currentVersion) !== minor(latestVersion) ||
            major(currentVersion) !== major(latestVersion))
        ) {
          observer.next(
            pc.red(
              `The latest version is ${latestVersion}, current version is ${currentVersion}, can not cross-version upgrade.\n`,
            ),
          )
          observer.complete()
          return
        }

        const stream$ = this.service.startClusterAdminAssetUpdate(latestVersion)
        await new Promise<void>((resolve) => {
          stream$.subscribe({
            next: (data) => observer.next(data),
            complete: () => resolve(),
            error: () => resolve(),
          })
        })
        observer.complete()
      })()
    })

    return sseOutput$.pipe(
      catchError((err) => {
        console.error(err)
        return sseOutput$
      }),
    )
  }
}
