import { Logger } from '@innei/pretty-logger-nestjs'
import { Test } from '@nestjs/testing'

import { PrettyLoggerModule } from '~/processors/logger/pretty-logger.module'

describe('PrettyLoggerModule', () => {
  it('provides Logger without resolving ConsoleLogger constructor tokens', async () => {
    const module = await Test.createTestingModule({
      imports: [PrettyLoggerModule],
    }).compile()

    const logger = module.get(Logger)
    expect(logger).toBeInstanceOf(Logger)
    await module.close()
  })
})
