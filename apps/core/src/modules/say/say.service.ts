import { Injectable } from '@nestjs/common'

import { SayRepository } from './say.repository'

/**
 * Thin façade over {@link SayRepository}. Cross-module consumers
 * (e.g. aggregate) call the named methods below instead of touching
 * the underlying drizzle / repository directly.
 */
@Injectable()
export class SayService {
  constructor(private readonly sayRepository: SayRepository) {}

  public get repository() {
    return this.sayRepository
  }

  findRecent(size: number) {
    return this.sayRepository.findRecent(size)
  }

  count() {
    return this.sayRepository.count()
  }
}
