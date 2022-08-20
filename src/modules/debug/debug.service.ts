import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'

@Injectable({ scope: Scope.REQUEST })
export class DebugService {
  constructor(@Inject(REQUEST) private req) {
    console.log('DebugService created')
  }

  test() {
    console.log('this.req', this.req.method)
  }
}
