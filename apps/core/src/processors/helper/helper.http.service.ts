import { inspect } from 'node:util'
import { chalk } from '@mx-space/compiled'
import { Injectable, Logger } from '@nestjs/common'
import { AXIOS_CONFIG, DEBUG_MODE } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'
import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import axiosRetry, { exponentialDelay } from 'axios-retry'
import { version } from '../../../package.json'
import { RedisService } from '../redis/redis.service'

const DEFAULT_UA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36 MX-Space/${version}`
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
  private readonly http: AxiosInstance
  private readonly logger: Logger
  constructor(private readonly redisService: RedisService) {
    this.logger = new Logger(HttpService.name)

    this.http = this.bindInterceptors(
      axios.create({
        ...AXIOS_CONFIG,
        headers: {
          'user-agent': DEFAULT_UA,
        },
      }),
    )

    axiosRetry(this.http, {
      // retries: 3,
      // retryDelay: (count) => {
      //   return 1000 * count
      // },
      // shouldResetTimeout: true,
      retryDelay: exponentialDelay,
      retries: 5,
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn(
          `HTTP Request Retry ${retryCount} times: [${requestConfig.method?.toUpperCase()}] ${
            requestConfig.baseURL || ''
          }${requestConfig.url}`,
        )
        this.logger.warn(`HTTP Request Retry Error: ${error.message}`)
      },
    })
  }

  private axiosDefaultConfig: AxiosRequestConfig<any> = {
    ...AXIOS_CONFIG,
    headers: {
      'user-agent': DEFAULT_UA,
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
    const client = this.redisService.getClient()
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
