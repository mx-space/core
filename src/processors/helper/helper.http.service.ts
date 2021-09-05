import { Injectable } from '@nestjs/common'
import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { AXIOS_CONFIG } from '~/app.config'
@Injectable()
export class HttpService {
  http: AxiosInstance
  constructor() {
    this.http = axios.create(AXIOS_CONFIG)
  }

  public get axiosRef() {
    return this.http
  }
}
