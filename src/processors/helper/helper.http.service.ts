import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import retryAxios from 'axios-retry'
import { inspect } from 'util'

import { Injectable, Logger } from '@nestjs/common'

import { AXIOS_CONFIG, DEBUG_MODE } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils'

import { version } from '../../../package.json'
import { CacheService } from '../redis/cache.service'

declare module 'axios' {
  interface AxiosRequestConfig {
    __requestStartedAt?: number
    __requestEndedAt?: number
    __requestDuration?: number

    __debugLogger?: boolean
  }
}

@Injectable()
export class HttpService {
  private http: AxiosInstance
  private logger: Logger
  constructor(private readonly cacheService: CacheService) {
    this.logger = new Logger(HttpService.name)

    this.http = this.bindInterceptors(
      axios.create({
        ...AXIOS_CONFIG,
        headers: {
          'user-agent': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36 MX-Space/${version}`,
        },
      }),
    )
    retryAxios(this.http, {
      retries: 3,
      retryDelay: (count) => {
        return 1000 * count
      },
      shouldResetTimeout: true,
    })
  }

  private axiosDefaultConfig: AxiosRequestConfig<any> = {
    ...AXIOS_CONFIG,
    headers: {
      'user-agent': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36 MX-Space/${version}`,
    },
    'axios-retry': {
      retries: 3,
      retryDelay: (count) => {
        return 1000 * count
      },
      shouldResetTimeout: true,
    },
  }

  extend(config: AxiosRequestConfig<any>) {
    return this.bindDebugVerboseInterceptor(
      axios.create({ ...this.axiosDefaultConfig, ...config }),
    )
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

  private bindDebugVerboseInterceptor($http: AxiosInstance) {
    if (!DEBUG_MODE.httpRequestVerbose) {
      return $http
    }
    $http.interceptors.request.use((req) => {
      if (!req.__debugLogger) {
        return req
      }
      req.__requestStartedAt = Date.now()

      this.logger.log(
        `HTTP Request: [${req.method?.toUpperCase()}] ${req.baseURL || ''}${
          req.url
        } 
params: ${this.prettyStringify(req.params)}
data: ${this.prettyStringify(req.data)}`,
      )

      return req
    })
    $http.interceptors.response.use(
      (res) => {
        if (!res.config.__debugLogger) {
          return res
        }
        const endAt = Date.now()
        res.config.__requestEndedAt = endAt
        res.config.__requestDuration =
          res.config?.__requestStartedAt ??
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          endAt - res.config!.__requestStartedAt!
        this.logger.log(
          `HTTP Response ${`${res.config.baseURL || ''}${
            res.config.url
          }`} +${res.config.__requestDuration.toFixed(
            2,
          )}ms: \n${this.prettyStringify(res.data)} `,
        )
        return res
      },
      (err) => {
        const res = err.response

        const error = Promise.reject(err)
        if (!res) {
          this.logger.error(
            `HTTP Response Failed ${err.config.url || ''}, Network Error: ${
              err.message
            }`,
          )
          return error
        }
        this.logger.error(
          chalk.red(
            `HTTP Response Failed ${`${res.config.baseURL || ''}${
              res.config.url
            }`}\n${this.prettyStringify(res.data)}`,
          ),
        )

        return error
      },
    )
    return $http
  }

  private bindInterceptors($http: AxiosInstance) {
    this.bindDebugVerboseInterceptor($http)
    return $http
  }

  private prettyStringify(data: any) {
    return inspect(data, { colors: true })
  }
}
