import { Global, Module } from '@nestjs/common'
import type { Provider } from '@nestjs/common'

export const createMockGlobalModule = (providers: Provider[]) => {
  @Global()
  @Module({
    providers,
    exports: providers,
  })
  class MockGlobalModule {}

  return MockGlobalModule
}
