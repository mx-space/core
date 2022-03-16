import { Injectable, Logger } from '@nestjs/common'
import type { AxiosInstance } from 'axios'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { version } from '../../../package.json'
import { CacheService } from '../cache/cache.service'
import { AXIOS_CONFIG } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils'
@Injectable()
export class HttpService {
  private http: AxiosInstance
  private logger: Logger
  constructor(private readonly cacheService: CacheService) {
    this.logger = new Logger(HttpService.name)
    this.http = axios.create({
      ...AXIOS_CONFIG,
      headers: {
        'user-agent': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36 MX-Space/${version}`,
      },
    })
    axiosRetry(this.http, {
      retries: 3,
      retryDelay: (count) => {
        return 1000 * count
      },
      shouldResetTimeout: true,
    })
  }

  /**
   * 缓存请求数据，现支持文本
   * @param url
   */
  public async getAndCacheRequest(url: string) {
    this.logger.debug(`--> GET: ${url}`)
    const client = this.cacheService.getClient()
    const has = await client.hget(getRedisKey(RedisKeys.HTTPCache), url)
    if (has) {
      this.logger.debug(`--> GET: ${url} from redis`)
      return has
    }
    const { data } = await this.http.get(url, {
      responseType: 'text',
    })
    this.logger.debug(`--> GET: ${url} from remote`)

    await client.hset(getRedisKey(RedisKeys.HTTPCache), url, data)
    return data
  }

  public get axiosRef() {
    return this.http
  }
}
