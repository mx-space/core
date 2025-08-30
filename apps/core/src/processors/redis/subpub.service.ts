import { Injectable } from '@nestjs/common'
import { redisSubPub } from '~/utils/redis-subpub.util'

@Injectable()
export class SubPubBridgeService {
  public publish(event: string, data: any) {
    return redisSubPub.publish(event, data)
  }

  public subscribe(event: string, callback: (data: any) => void) {
    return redisSubPub.subscribe(event, callback)
  }

  public unsubscribe(event: string, callback: (data: any) => void) {
    return redisSubPub.unsubscribe(event, callback)
  }
}
