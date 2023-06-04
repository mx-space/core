import { appendFile, rm, writeFile } from 'fs/promises'
import { inspect } from 'util'
import axios from 'axios'
import { spawn } from 'node-pty'
import { catchError, Observable } from 'rxjs'
import type { Subscriber } from 'rxjs'

import { Injectable } from '@nestjs/common'

import { dashboard } from '~/../package.json'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { HttpService } from '~/processors/helper/helper.http.service'

const { repo } = dashboard

@Injectable()
export class UpdateService {
  constructor(protected readonly httpService: HttpService) {}
  downloadAdminAsset(version: string) {
    const observable$ = new Observable<string>((subscriber) => {
      ;(async () => {
        const endpoint = `https://api.github.com/repos/${repo}/releases/tags/v${version}`

        subscriber.next(`Geting release info from ${endpoint}.\n`)

        const json = await fetch(endpoint)
          .then((res) => res.json())
          .catch((err) => {
            subscriber.next(chalk.red(`Fetching error: ${err.message}`))
            subscriber.complete()
            return null
          })

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

        const cdnDownloadUrl = `https://ghproxy.com/${downloadUrl}`

        subscriber.next(
          `Downloading admin asset v${version}\nFrom: ${cdnDownloadUrl}\n`,
        )
        const buffer = await axios
          .get(cdnDownloadUrl, {
            responseType: 'arraybuffer',
          })
          .then((res) => res.data as ArrayBuffer)
          .catch((err) => {
            subscriber.next(chalk.red(`Downloading error: ${err.message}`))
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
        } catch (err) {
          subscriber.next(chalk.red(`Updating error: ${err.message}\n`))
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

    const res = await this.httpService.axiosRef.get(endpoint)
    return res.data.tag_name.replace(/^v/, '')
  }

  private runShellCommandPipeOutput(
    command: string,
    args: any[],
    subscriber: Subscriber<string>,
  ) {
    return new Promise((resolve) => {
      subscriber.next(`${chalk.yellow(`$`)} ${command} ${args.join(' ')}\n`)

      const pty = spawn(command, args, {})
      pty.onData((data) => {
        subscriber.next(data.toString())
      })
      pty.onExit(() => {
        resolve(null)
      })
    })
  }
}
