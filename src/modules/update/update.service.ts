import { appendFile } from 'fs-extra'
import { rm, writeFile } from 'fs/promises'
import { Observable } from 'rxjs'
import { Stream } from 'stream'
import { inspect } from 'util'

import { Injectable } from '@nestjs/common'

import { dashboard } from '~/../package.json'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import { HttpService } from '~/processors/helper/helper.http.service'

const { repo } = dashboard

@Injectable()
export class UpdateService {
  constructor(protected readonly httpService: HttpService) {}
  downloadAdminAsset(version: string) {
    // @ts-expect-error
    const observable$ = new Observable<string>(async (subscriber) => {
      const endpoint = `https://api.github.com/repos/${repo}/releases/tags/v${version}`

      subscriber.next(`Downloading admin asset v${version}`)
      subscriber.next(`Get from ${endpoint}`)

      const json = await fetch(endpoint)
        .then((res) => res.json())
        .catch((err) => {
          subscriber.next(chalk.red(`Fetching error: ${err.message}`))
          subscriber.complete()
          return null
        })

      if (!json) {
        return
      }

      const downloadUrl = json.assets?.find(
        (asset) => asset.name === 'release.zip',
      )?.browser_download_url

      if (!downloadUrl) {
        subscriber.next(chalk.red('Download url not found'))
        subscriber.next(
          chalk.red(
            `Full json fetched: ${inspect(json, false, undefined, true)}`,
          ),
        )
        subscriber.complete()
        return
      }

      const buffer = await fetch(downloadUrl)
        .then((res) => res.arrayBuffer())
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

      const writable = new Stream.Writable({
        autoDestroy: false,
        write(chunk, _encoding, callback) {
          subscriber.next(chunk.toString())
        },
      })
      const folder = LOCAL_ADMIN_ASSET_PATH.replace(/\/admin$/, '')
      await rm(LOCAL_ADMIN_ASSET_PATH, { force: true, recursive: true })

      await $`ls -lh`.pipe(writable)
      await nothrow($`unzip -o admin-release.zip -d ${folder}`)
      await $`mv ${folder}/dist ${folder}/admin`.pipe(writable)
      await $`rm -f admin-release.zip`.pipe(writable)

      await writeFile(
        path.resolve(LOCAL_ADMIN_ASSET_PATH, 'version'),
        version,
        {
          encoding: 'utf8',
        },
      )

      writable.end()
      writable.destroy()

      writable.on('close', () => {
        subscriber.next(`Downloading finished.`)
        subscriber.complete()
      })
    })

    return observable$
  }

  async getLatestAdminVersion() {
    const endpoint = `https://api.github.com/repos/${repo}/releases/latest`

    const res = await this.httpService.axiosRef.get(endpoint)
    return res.data.tag_name.replace(/^v/, '')
  }
}
