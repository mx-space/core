import { Injectable, Logger } from '@nestjs/common'

import type { EchoScenario } from './scenario.types'

@Injectable()
export class EchoScenarioRegistry {
  private readonly logger = new Logger(EchoScenarioRegistry.name)
  private readonly byKey = new Map<string, EchoScenario>()

  register(scenario: EchoScenario): void {
    if (this.byKey.has(scenario.key)) {
      this.logger.warn(
        `Echo scenario "${scenario.key}" already registered; overwriting`,
      )
    }
    this.byKey.set(scenario.key, scenario)
    this.logger.log(`Echo scenario registered: ${scenario.key}`)
  }

  get(key: string): EchoScenario | undefined {
    return this.byKey.get(key)
  }

  list(): EchoScenario[] {
    return [...this.byKey.values()]
  }

  clear(): void {
    this.byKey.clear()
  }
}
