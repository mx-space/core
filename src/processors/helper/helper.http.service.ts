import { Injectable } from '@nestjs/common'
import type { AxiosInstance } from 'axios'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { AXIOS_CONFIG } from '~/app.config'

@Injectable()
export class HttpService {
  private http: AxiosInstance
  constructor() {
    this.http = axios.create(AXIOS_CONFIG)
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
