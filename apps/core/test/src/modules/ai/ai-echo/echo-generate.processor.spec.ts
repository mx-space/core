import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EchoScenarioRegistry } from '~/modules/ai/ai-echo/echo-scenario.registry'
import type { EchoScenario } from '~/modules/ai/ai-echo/scenario.types'
import { EchoGenerateTaskProcessor } from '~/modules/ai/ai-echo/tasks/echo-generate.processor'

const makeContext = () => ({
  taskId: 'task-1',
  signal: new AbortController().signal,
  updateProgress: vi.fn(async () => {}),
  incrementTokens: vi.fn(async () => {}),
  appendLog: vi.fn(async () => {}),
  setResult: vi.fn(async () => {}),
  setStatus: vi.fn(() => {}),
  isAborted: () => false,
})

const stubScenario: EchoScenario = {
  key: 'recently',
  defaultPersonas: ['inner-self'],
  async loadSubject() {
    return { id: 'subject', content: 'hi' }
  },
  extractRetrievalQuery() {
    return null
  },
  buildPrompt() {
    return [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]
  },
}

const buildProcessor = (rowOverrides: Partial<any> = {}) => {
  const row = {
    id: 'echo-1',
    scenarioKey: 'recently',
    subjectType: 'recently',
    subjectId: '10001',
    personaKey: 'inner-self',
    status: 'pending',
    metadata: {},
    ...rowOverrides,
  }
  const repository = {
    findById: vi.fn(async () => row),
    update: vi.fn(async (id: string, patch: any) => {
      Object.assign(row, patch)
      return row
    }),
  }
  const registry = new EchoScenarioRegistry()
  registry.register(stubScenario)
  const eventManager = { emit: vi.fn() }
  const taskProcessor = { registerHandler: vi.fn() }
  const aiService = {
    getEchoModel: vi.fn(async () => ({
      providerInfo: { id: 'mock', type: 'openai-compatible', model: 'm' },
      generateText: vi.fn(async () => ({ text: 'echo content' })),
    })),
  }
  const aiEmbeddingsService = { search: vi.fn(async () => []) }
  const aiMemoryService = { recall: vi.fn(async () => []) }
  const aiPersonaService = {
    getProfileOrNull: vi.fn(async () => null),
    pickExemplars: vi.fn(async () => []),
  }
  const configsService = {
    get: vi.fn(async () => ({})),
  }
  const processor = new EchoGenerateTaskProcessor(
    taskProcessor as any,
    repository as any,
    aiService as any,
    aiEmbeddingsService as any,
    aiMemoryService as any,
    aiPersonaService as any,
    configsService as any,
    eventManager as any,
    registry,
  )
  return { processor, repository, row, eventManager, aiService }
}

describe('EchoGenerateTaskProcessor', () => {
  let context: ReturnType<typeof makeContext>

  beforeEach(() => {
    context = makeContext()
  })

  it('step-2 guard: status NOT IN (pending|generating) -> no writes, no events', async () => {
    for (const status of ['ready', 'edited', 'failed', 'archived']) {
      const { processor, repository, eventManager } = buildProcessor({ status })
      await processor.handle({ echoId: 'echo-1' }, context as any)
      expect(repository.update).not.toHaveBeenCalled()
      expect(eventManager.emit).not.toHaveBeenCalled()
    }
  })

  it('proceeds when status is pending', async () => {
    const { processor, repository } = buildProcessor({ status: 'pending' })
    await processor.handle({ echoId: 'echo-1' }, context as any)
    expect(repository.update).toHaveBeenCalled()
    const finalCall = repository.update.mock.calls.at(-1)!
    expect(finalCall[1].status).toBe('ready')
    expect(finalCall[1].content).toBe('echo content')
  })

  it('returns silently when row not found', async () => {
    const repository = { findById: vi.fn(async () => null), update: vi.fn() }
    const registry = new EchoScenarioRegistry()
    const processor = new EchoGenerateTaskProcessor(
      { registerHandler: vi.fn() } as any,
      repository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      registry,
    )
    await processor.handle({ echoId: 'echo-missing' }, context as any)
    expect(repository.update).not.toHaveBeenCalled()
  })
})
