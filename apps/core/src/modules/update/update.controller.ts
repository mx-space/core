import path from 'node:path'
import { isSemVer } from 'class-validator'
import { catchError, lastValueFrom, Observable } from 'rxjs'
import { lt, major, minor } from 'semver'

import { chalk, fs } from '@mx-space/compiled'
import { Query, Sse } from '@nestjs/common'

import { dashboard } from '~/../package.json'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'

import { UpdateAdminDto } from './update.dto'
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
        let { version: currentVersion } = dashboard

        const isExistLocalAdmin = fs.pathExistsSync(LOCAL_ADMIN_ASSET_PATH)

        if (!isExistLocalAdmin) {
          // 2. if not has local admin, then pull remote admin version.
          const stream$ = this.service.downloadAdminAsset(currentVersion)
          stream$.subscribe((data) => {
            observer.next(data)
          })
          await lastValueFrom(stream$)
          observer.complete()
          return
        }

        const versionPath = path.resolve(LOCAL_ADMIN_ASSET_PATH, 'version')
        const isHasVersion = fs.existsSync(versionPath)
        if (isHasVersion) {
          const versionInfo = await fs.promises
            .readFile(versionPath, {
              encoding: 'utf8',
            })
            .then((data) => data.split('\n')[0])
            .catch(() => '')
          if (isSemVer(versionInfo)) {
            currentVersion = versionInfo
          }
        }

        // 3. fetch latest admin version
        const latestVersion = await this.service
          .getLatestAdminVersion()
          .catch((error) => {
            observer.next(
              chalk.red(
                `Fetching latest admin version error: ${error.message}\n`,
              ),
            )
            observer.complete()
            return ''
          })

        if (!latestVersion) {
          return
        }

        if (!lt(currentVersion, latestVersion)) {
          observer.next(chalk.green(`Admin dashboard is up to date.\n`))
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
            chalk.red(
              `The latest version is ${latestVersion}, current version is ${currentVersion}, can not cross-version upgrade.\n`,
            ),
          )
          observer.complete()
          return
        }

        // 4. download latest admin version
        const stream$ = this.service.downloadAdminAsset(latestVersion)

        stream$.subscribe((data) => {
          observer.next(data)
        })
        await lastValueFrom(stream$)
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
