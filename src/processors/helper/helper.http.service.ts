import { Injectable } from '@nestjs/common'
import type { AxiosInstance } from 'axios'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { AXIOS_CONFIG } from '~/app.config'
import { version } from '../../../package.json'
@Injectable()
export class HttpService {
  private http: AxiosInstance
  constructor() {
    this.http = axios.create({
      ...AXIOS_CONFIG,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36 MX-Space/' +
          version,
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

  public get axiosRef() {
    return this.http
  }
}
