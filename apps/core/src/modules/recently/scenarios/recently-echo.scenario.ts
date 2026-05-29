import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'

import { AiEchoService } from '../../ai/ai-echo/ai-echo.service'
import { buildRecentlyEchoPrompt } from '../../ai/ai-echo/echo-prompt-builder'
import { EchoScenarioRegistry } from '../../ai/ai-echo/echo-scenario.registry'
import type { EchoScenario } from '../../ai/ai-echo/scenario.types'
import { RecentlyService } from '../recently.service'
import type { RecentlyRow } from '../recently.types'

export const buildRecentlyEchoScenario = (
  recentlyService: RecentlyService,
): EchoScenario<RecentlyRow> => ({
  key: 'recently',
  triggerEvent: BusinessEvents.RECENTLY_CREATE,
  defaultPersonas: ['inner-self', 'passerby'],
  persistEchoes: true,
  emitOnReady: BusinessEvents.RECENTLY_ECHO_LANDED,
  async loadSubject(id: string) {
    const row = await recentlyService.repository.findById(id)
    return row ?? null
  },
  extractRetrievalQuery(recently) {
    return recently.content?.trim() || null
  },
  buildPrompt(input) {
    return buildRecentlyEchoPrompt(input)
  },
})

@Injectable()
export class RecentlyEchoScenarioRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: EchoScenarioRegistry,
    private readonly recentlyService: RecentlyService,
  ) {}

  onModuleInit() {
    this.registry.register(buildRecentlyEchoScenario(this.recentlyService))
  }
}

@Injectable()
export class RecentlyEchoSubjectDeleteListener {
  private readonly logger = new Logger(RecentlyEchoSubjectDeleteListener.name)

  constructor(private readonly aiEchoService: AiEchoService) {}

  @OnEvent(BusinessEvents.RECENTLY_DELETE)
  async handleDelete(payload: { id?: string } | undefined) {
    const id = payload?.id
    if (!id) return
    try {
      await this.aiEchoService.handleSubjectDeleted('recently', id)
    } catch (error) {
      this.logger.warn(
        `Failed to cascade recently delete to ai-echo: id=${id} error=${(error as Error).message}`,
      )
    }
  }
}
