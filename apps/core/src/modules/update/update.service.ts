import { appendFile, rm, writeFile } from 'node:fs/promises'
import { inspect } from 'node:util'
import axios from 'axios'
import { catchError, Observable } from 'rxjs'
import type { Subscriber } from 'rxjs'

import { Injectable } from '@nestjs/common'

import { dashboard } from '~/../package.json'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { HttpService } from '~/processors/helper/helper.http.service'
import { spawnShell } from '~/utils/system.util'

import { ConfigsService } from '../configs/configs.service'

const { repo } = dashboard

@Injectable()
export class UpdateService {
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigsService,
  ) {}
  downloadAdminAsset(version: string) {
    const observable$ = new Observable<string>((subscriber) => {
      ;(async () => {
        const { githubToken } = await this.configService.get(
          'thirdPartyServiceIntegration',
        )
        const endpoint = `https://api.github.com/repos/${repo}/releases/tags/v${version}`

        subscriber.next(`Getting release info from ${endpoint}.\n`)

        const result = await this.httpService.axiosRef
          .get(endpoint, {
            headers: {
              ...(githubToken && { Authorization: `Bearer ${githubToken}` }),
            },
          })

          .catch((error) => {
            subscriber.next(chalk.red(`Fetching error: ${error.message}`))
            subscriber.complete()
            return null
          })
        const json = result?.data
        if (!json) {
          subscriber.next(chalk.red('Fetching error, json is empty. \n'))
          subscriber.complete()
          return
        }

        const downloadUrl = json.assets?.find(
          (asset) => asset.name === 'release.zip',
        )?.browser_download_url

        if (!downloadUrl) {
          subscriber.next(chalk.red('Download url not found.\n'))
          subscriber.next(
            chalk.red(
              `Full json fetched: \n${inspect(json, false, undefined, true)}`,
            ),
          )
          subscriber.complete()
          return
        }

        const cdnDownloadUrl = `https://ghfast.top/${downloadUrl}`
        // const cdnDownloadUrl = downloadUrl

        subscriber.next(
          `Downloading admin asset v${version}\nFrom: ${cdnDownloadUrl}\n`,
        )
        const buffer = await axios
          .get(cdnDownloadUrl, {
            responseType: 'arraybuffer',
          })
          .then((res) => res.data as ArrayBuffer)
          .catch((error) => {
            subscriber.next(chalk.red(`Downloading error: ${error.message}`))
            subscriber.complete()
            return null
          })

        if (!buffer) {
          return
        }

        await rm('admin-release.zip', { force: true })

        await appendFile(
          path.resolve(process.cwd(), 'admin-release.zip'),
          Buffer.from(buffer),
        )

        const folder = LOCAL_ADMIN_ASSET_PATH.replace(/\/admin$/, '')
        await rm(LOCAL_ADMIN_ASSET_PATH, { force: true, recursive: true })

        try {
          // @ts-ignore
          const cmds: readonly [string, string[]][] = [
            `unzip -t admin-release.zip`,
            `unzip -o admin-release.zip -d ${folder}`,
            `mv ${folder}/dist ${LOCAL_ADMIN_ASSET_PATH}`,
            `rm -f admin-release.zip`,
            // @ts-ignore
          ].reduce((acc, fullCmd) => {
            const [cmd, ...args] = fullCmd.split(' ')
            return [...acc, [cmd, args]] as const
          }, [])

          for (const exec of cmds) {
            const [cmd, args] = exec
            await this.runShellCommandPipeOutput(cmd, args, subscriber)
          }

          await writeFile(
            path.resolve(LOCAL_ADMIN_ASSET_PATH, 'version'),
            version,
            {
              encoding: 'utf8',
            },
          )

          subscriber.next(chalk.green(`Downloading finished.\n`))
        } catch (error) {
          subscriber.next(chalk.red(`Updating error: ${error.message}\n`))
        } finally {
          subscriber.complete()
        }

        await rm('admin-release.zip', { force: true })
      })()
    })

    return observable$.pipe(
      catchError((err) => {
        console.error(err)
        return observable$
      }),
    )
  }

  async getLatestAdminVersion() {
    const endpoint = `https://api.github.com/repos/${repo}/releases/latest`

    const { githubToken } = await this.configService.get(
      'thirdPartyServiceIntegration',
    )
    const res = await this.httpService.axiosRef.get(endpoint, {
      headers: {
        ...(githubToken && { Authorization: `Bearer ${githubToken}` }),
      },
    })
    return res.data.tag_name.replace(/^v/, '')
  }

  private runShellCommandPipeOutput(
    command: string,
    args: any[],
    subscriber: Subscriber<string>,
  ) {
    return new Promise((resolve, reject) => {
      subscriber.next(`${chalk.yellow(`$`)} ${command} ${args.join(' ')}\n`)

      const pty = spawnShell(command, args, {})
      pty.onData((data) => {
        subscriber.next(data.toString())
      })
      pty.onExit((e) => {
        if (e.exitCode !== 0) {
          reject(e)
        } else {
          resolve(null)
        }
      })
    })
  }
}
