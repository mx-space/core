import { Injectable } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'

import { HttpService } from './helper.http.service'

@Injectable()
export class BarkPushService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigsService,
  ) {}
}
