import {
  Agent,
  type AgentMessage,
  type AgentTool,
} from '@mariozechner/pi-agent-core'
import type { Model } from '@mariozechner/pi-ai'
import { Injectable, Logger } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { AIProviderType, type AIProviderConfig } from '../ai.types'
import { AIAgentActionModel } from './ai-agent-action.model'
import { AIAgentMessageModel } from './ai-agent-message.model'
import { AIAgentRuntimeConfigModel } from './ai-agent-runtime-config.model'
import { AIAgentSessionModel } from './ai-agent-session.model'
import { AI_AGENT_SYSTEM_PROMPT_LINES } from './ai-agent-system-prompt'
import type {
  SendAIAgentMessageInput,
  UpsertAIAgentConfigInput,
} from './ai-agent.schema'
import {
  AIAgentActionRiskLevel,
  AIAgentActionState,
  AIAgentMessageKind,
  AIAgentSessionStatus,
  getAgentSessionRoom,
  type AIAgentRuntimeConfigValue,
  type AIAgentToolId,
} from './ai-agent.types'
import {
  createConnectorRegistry,
  normalizeEnabledToolIds,
  resolveEnabledConnectors,
} from './tools/connector-registry'
import {
  buildConnectorSystemPrompt,
  type AIAgentToolConnector,
} from './tools/connector.types'
import {
  createMongoToolConnector,
  executeMongoConfirmedAction,
  executeMongoTool,
  type MongoToolArgs,
} from './tools/connectors/mongodb'
import {
  createShellToolConnector,
  executeShellConfirmedAction,
  executeShellTool,
  type ShellToolArgs,
} from './tools/connectors/shell'

const AGENT_RUNTIME_CONFIG_KEY = 'default'
const MAX_TOOL_OUTPUT_LENGTH = 16_000

type AIAgentLoopStart = { mode: 'prompt'; input: string } | { mode: 'continue' }

@Injectable()
export class AIAgentService {
  private readonly logger = new Logger(AIAgentService.name)
  private readonly runningSessions = new Map<string, Promise<void>>()

  constructor(
    @InjectModel(AIAgentRuntimeConfigModel)
    private readonly runtimeConfigModel: MongooseModel<AIAgentRuntimeConfigModel>,
    @InjectModel(AIAgentSessionModel)
    private readonly sessionModel: MongooseModel<AIAgentSessionModel>,
    @InjectModel(AIAgentMessageModel)
    private readonly messageModel: MongooseModel<AIAgentMessageModel>,
    @InjectModel(AIAgentActionModel)
    private readonly actionModel: MongooseModel<AIAgentActionModel>,
    private readonly databaseService: DatabaseService,
    private readonly eventManager: EventManagerService,
  ) {}

  async getRuntimeConfig(): Promise<AIAgentRuntimeConfigValue> {
    const connectorRegistry = this.buildConnectorRegistry()
    const doc = await this.runtimeConfigModel
      .findOne({ key: AGENT_RUNTIME_CONFIG_KEY })
      .lean()

    if (!doc) {
      return {
        providers: [],
        enabledTools: normalizeEnabledToolIds(undefined, connectorRegistry),
      }
    }

    return {
      providers: (doc.providers || []) as AIProviderConfig[],
      agentModel: doc.agentModel,
      enabledTools: normalizeEnabledToolIds(
        doc.enabledTools as string[] | undefined,
        connectorRegistry,
      ),
    }
  }

  async upsertRuntimeConfig(input: UpsertAIAgentConfigInput) {
    const connectorRegistry = this.buildConnectorRegistry()
    const providers = input.providers.map((provider) => ({
      ...provider,
      apiKey: provider.apiKey.trim(),
      endpoint: provider.endpoint?.trim() || undefined,
    }))
    const enabledTools = normalizeEnabledToolIds(
      input.enabledTools as string[] | undefined,
      connectorRegistry,
    )

    const doc = await this.runtimeConfigModel.findOneAndUpdate(
      { key: AGENT_RUNTIME_CONFIG_KEY },
      {
        $set: {
          key: AGENT_RUNTIME_CONFIG_KEY,
          providers,
          agentModel: input.agentModel,
          enabledTools,
          updated: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
      },
    )

    return {
      providers: (doc.providers || []) as AIProviderConfig[],
      agentModel: doc.agentModel,
      enabledTools: normalizeEnabledToolIds(
        doc.enabledTools as string[] | undefined,
        connectorRegistry,
      ),
    }
  }

  async createSession(title?: string) {
    const session = await this.sessionModel.create({
      title: title?.trim() || 'Agent Session',
      status: AIAgentSessionStatus.Active,
      updated: new Date(),
    })

    return session
  }

  async listSessions() {
    return this.sessionModel.find().sort({ updated: -1, created: -1 }).lean()
  }

  async getSession(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId).lean()
    if (!session) {
      throw new BizException(
        ErrorCodeEnum.ResourceNotFound,
        'Session not found',
      )
    }

    const pendingActions = await this.actionModel
      .find({
        sessionId,
        state: AIAgentActionState.Pending,
      })
      .sort({ created: -1 })
      .lean()

    return {
      session,
      pendingActions,
      running: this.runningSessions.has(sessionId),
    }
  }

  async getSessionMessages(sessionId: string, page = 1, size = 50) {
    await this.assertSessionExists(sessionId)

    const skip = (page - 1) * size

    const [total, data] = await Promise.all([
      this.messageModel.countDocuments({ sessionId }),
      this.messageModel
        .find({ sessionId })
        .sort({ seq: 1 })
        .skip(skip)
        .limit(size)
        .lean(),
    ])

    return {
      data,
      total,
      page,
      size,
      hasMore: page * size < total,
    }
  }

  async sendMessage(sessionId: string, body: SendAIAgentMessageInput) {
    await this.assertSessionExists(sessionId)

    const pendingActionCount = await this.actionModel.countDocuments({
      sessionId,
      state: AIAgentActionState.Pending,
    })

    if (pendingActionCount > 0) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'Pending confirmation actions exist. Confirm or reject them first.',
      )
    }

    const started = this.startAgentLoop(sessionId, {
      mode: 'prompt',
      input: body.content,
    })

    if (!started) {
      throw new BizException(
        ErrorCodeEnum.AIProcessing,
        'Agent is already running for this session',
      )
    }

    return {
      accepted: true,
      running: true,
    }
  }

  async confirmAction(actionId: string) {
    const action = await this.actionModel.findById(actionId)
    if (!action) {
      throw new BizException(ErrorCodeEnum.ResourceNotFound, 'Action not found')
    }

    if (action.state !== AIAgentActionState.Pending) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        `Action is not pending: ${action.state}`,
      )
    }

    action.state = AIAgentActionState.Confirmed
    action.updated = new Date()
    await action.save()

    let result: Record<string, unknown>
    let errorMessage: string | undefined

    try {
      result = await this.executeConfirmedAction(action)
      action.state = AIAgentActionState.Executed
      action.result = result
    } catch (error) {
      errorMessage = (error as Error)?.message || 'Unknown execution error'
      action.state = AIAgentActionState.Cancelled
      action.error = errorMessage
      action.result = {
        error: errorMessage,
      }
    }

    action.updated = new Date()
    await action.save()

    const seq = { value: await this.getNextSeq(action.sessionId) }
    const confirmContent = {
      actionId: action.id,
      state: action.state,
      toolName: action.toolName,
      result: action.result,
      error: action.error,
    }

    await this.createMessage(
      action.sessionId,
      seq,
      'system',
      AIAgentMessageKind.ConfirmResult,
      confirmContent,
    )

    await this.createAgentMessage(
      action.sessionId,
      seq,
      this.createActionResolutionMessage(action),
      AIAgentMessageKind.ConfirmResult,
    )

    await this.emitToSession(
      action.sessionId,
      BusinessEvents.AI_AGENT_CONFIRM_RESULT,
      confirmContent,
    )

    await this.maybeResumeAfterConfirmations(action.sessionId)

    return {
      success: !errorMessage,
      action,
    }
  }

  async rejectAction(actionId: string) {
    const action = await this.actionModel.findById(actionId)
    if (!action) {
      throw new BizException(ErrorCodeEnum.ResourceNotFound, 'Action not found')
    }

    if (action.state !== AIAgentActionState.Pending) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        `Action is not pending: ${action.state}`,
      )
    }

    action.state = AIAgentActionState.Rejected
    action.updated = new Date()
    await action.save()

    const seq = { value: await this.getNextSeq(action.sessionId) }
    const rejectContent = {
      actionId: action.id,
      state: action.state,
      toolName: action.toolName,
    }

    await this.createMessage(
      action.sessionId,
      seq,
      'system',
      AIAgentMessageKind.ConfirmResult,
      rejectContent,
    )

    await this.createAgentMessage(
      action.sessionId,
      seq,
      this.createActionResolutionMessage(action),
      AIAgentMessageKind.ConfirmResult,
    )

    await this.emitToSession(
      action.sessionId,
      BusinessEvents.AI_AGENT_CONFIRM_RESULT,
      rejectContent,
    )

    await this.maybeResumeAfterConfirmations(action.sessionId)

    return {
      success: true,
      action,
    }
  }

  private startAgentLoop(sessionId: string, start: AIAgentLoopStart) {
    if (this.runningSessions.has(sessionId)) {
      return false
    }

    const task = this.runAgentLoop(sessionId, start)
      .catch((error) => {
        this.logger.error(
          `runAgentLoop failed: mode=${start.mode} session=${sessionId} error=${error?.message || error}`,
          error?.stack,
        )
      })
      .finally(() => {
        this.runningSessions.delete(sessionId)
      })

    this.runningSessions.set(sessionId, task)
    return true
  }

  private async maybeResumeAfterConfirmations(sessionId: string) {
    const pendingActionCount = await this.actionModel.countDocuments({
      sessionId,
      state: AIAgentActionState.Pending,
    })
    if (pendingActionCount > 0) {
      return
    }

    this.startAgentLoop(sessionId, { mode: 'continue' })
  }

  private async runAgentLoop(sessionId: string, start: AIAgentLoopStart) {
    const historyMessages = await this.loadAgentMessagesForLoop(sessionId)
    const runtime = await this.getRuntimeConfig()
    const { model, selectedProvider } = this.resolvePiModel(runtime)
    const enabledConnectors = this.resolveEnabledConnectors(
      runtime.enabledTools,
    )
    const apiKeyResolver = this.createApiKeyResolver(runtime.providers)

    const seq = {
      value: await this.getNextSeq(sessionId),
    }

    let promptMessage: AgentMessage | null = null
    if (start.mode === 'prompt') {
      promptMessage = this.createUserMessage(start.input)
      await this.createAgentMessage(
        sessionId,
        seq,
        promptMessage,
        AIAgentMessageKind.User,
      )
    }

    await this.sessionModel.updateOne(
      { _id: sessionId },
      {
        $set: { updated: new Date() },
      },
    )

    await this.emitToSession(sessionId, BusinessEvents.AI_AGENT_SESSION_STATE, {
      sessionId,
      state: 'running',
    })

    const agent = new Agent({
      initialState: {
        systemPrompt: this.buildSystemPrompt(enabledConnectors),
        model,
        messages: historyMessages,
        tools: this.buildAgentTools(enabledConnectors, sessionId, seq),
      },
      getApiKey: (providerName) => {
        return apiKeyResolver(providerName) || selectedProvider.apiKey
      },
      transport: 'websocket',
      maxRetryDelayMs: 60_000,
    })

    let persistQueue = Promise.resolve()
    let hasPersistedAssistantOrToolMessage = false
    let isPausedForConfirmation = false

    const unsubscribe = agent.subscribe((event) => {
      // Pause the current loop as soon as a tool reports pending confirmation.
      if (
        this.isPendingConfirmationToolEvent(event) &&
        !isPausedForConfirmation
      ) {
        isPausedForConfirmation = true
        agent.abort()
      }

      persistQueue = persistQueue.then(async () => {
        switch (event.type) {
          case 'message_update': {
            if (event.assistantMessageEvent.type === 'text_delta') {
              await this.emitToSession(
                sessionId,
                BusinessEvents.AI_AGENT_MESSAGE,
                {
                  sessionId,
                  kind: 'assistant_delta',
                  delta: event.assistantMessageEvent.delta,
                },
              )
            }
            break
          }

          case 'message_end': {
            if (
              event.message.role === 'assistant' ||
              event.message.role === 'toolResult'
            ) {
              if (
                isPausedForConfirmation &&
                event.message.role === 'assistant' &&
                this.isAbortAssistantMessage(event.message)
              ) {
                break
              }

              hasPersistedAssistantOrToolMessage = true
              const kind =
                event.message.role === 'assistant'
                  ? AIAgentMessageKind.Assistant
                  : AIAgentMessageKind.ToolResult
              await this.createAgentMessage(sessionId, seq, event.message, kind)
            }
            break
          }

          case 'agent_end': {
            // If provider initialization failed before message streaming starts
            // (e.g. missing api key), pi-agent may emit only agent_end with an
            // assistant error message. Persist it so UI can render the failure.
            if (hasPersistedAssistantOrToolMessage) {
              break
            }

            const lastMessage = event.messages.at(-1)
            if (
              lastMessage?.role === 'assistant' &&
              !(
                isPausedForConfirmation &&
                this.isAbortAssistantMessage(lastMessage)
              )
            ) {
              await this.createAgentMessage(
                sessionId,
                seq,
                lastMessage,
                AIAgentMessageKind.Assistant,
              )
              hasPersistedAssistantOrToolMessage = true
            }
            break
          }

          case 'tool_execution_start':
          case 'tool_execution_update':
          case 'tool_execution_end': {
            await this.emitToSession(
              sessionId,
              BusinessEvents.AI_AGENT_TOOL_EVENT,
              {
                sessionId,
                event,
              },
            )
            break
          }
        }
      })
    })

    try {
      if (start.mode === 'prompt') {
        await agent.prompt(promptMessage as AgentMessage)
      } else {
        await agent.continue()
      }
      await persistQueue
    } finally {
      unsubscribe()
      await this.emitToSession(
        sessionId,
        BusinessEvents.AI_AGENT_SESSION_STATE,
        {
          sessionId,
          state: 'idle',
        },
      )
    }
  }

  private buildConnectorRegistry() {
    return createConnectorRegistry([
      createMongoToolConnector((id, seq, params) => {
        return this.handleMongoToolExecution(id, seq, params)
      }),
      createShellToolConnector((id, seq, params) => {
        return this.handleShellToolExecution(id, seq, params)
      }),
    ])
  }

  private resolveEnabledConnectors(enabledTools: readonly AIAgentToolId[]) {
    const registry = this.buildConnectorRegistry()
    const normalized = normalizeEnabledToolIds(enabledTools, registry)
    return resolveEnabledConnectors(normalized, registry)
  }

  private buildAgentTools(
    connectors: AIAgentToolConnector[],
    sessionId: string,
    seq: { value: number },
  ): AgentTool<any>[] {
    return connectors.map((connector) => {
      return connector.createTool({
        sessionId,
        seq,
      })
    })
  }

  private async handleMongoToolExecution(
    sessionId: string,
    seq: { value: number },
    params: MongoToolArgs,
  ) {
    return executeMongoTool({
      db: this.databaseService.db,
      sessionId,
      seq,
      params,
      safeJson: (input) => this.safeJson(input),
      createPendingAction: (id, currentSeq, toolName, args, dryRunPreview) => {
        return this.createPendingAction(
          id,
          currentSeq,
          toolName,
          args,
          dryRunPreview,
        )
      },
    })
  }

  private async handleShellToolExecution(
    sessionId: string,
    seq: { value: number },
    params: ShellToolArgs,
  ) {
    return executeShellTool({
      sessionId,
      seq,
      params,
      safeJson: (input) => this.safeJson(input),
      createPendingAction: (id, currentSeq, toolName, args, dryRunPreview) => {
        return this.createPendingAction(
          id,
          currentSeq,
          toolName,
          args,
          dryRunPreview,
        )
      },
    })
  }

  private async createPendingAction(
    sessionId: string,
    seq: { value: number },
    toolName: string,
    args: Record<string, unknown>,
    dryRunPreview: Record<string, unknown>,
  ) {
    const action = await this.actionModel.create({
      sessionId,
      toolName,
      arguments: args,
      riskLevel: AIAgentActionRiskLevel.Dangerous,
      state: AIAgentActionState.Pending,
      dryRunPreview,
      updated: new Date(),
    })

    const payload = {
      actionId: action.id,
      toolName,
      args,
      dryRunPreview,
      state: AIAgentActionState.Pending,
    }

    await this.createMessage(
      sessionId,
      seq,
      'system',
      AIAgentMessageKind.ConfirmRequest,
      payload,
    )

    await this.emitToSession(
      sessionId,
      BusinessEvents.AI_AGENT_CONFIRM_REQUEST,
      payload,
    )

    return action
  }

  private async executeConfirmedAction(action: AIAgentActionModel) {
    if (action.toolName === 'mongodb') {
      return executeMongoConfirmedAction(
        this.databaseService.db,
        action.arguments,
      )
    }

    if (action.toolName === 'shell') {
      return executeShellConfirmedAction(action.arguments)
    }

    throw new Error(`Unsupported action tool: ${action.toolName}`)
  }

  private async assertSessionExists(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId).lean()
    if (!session) {
      throw new BizException(
        ErrorCodeEnum.ResourceNotFound,
        'Session not found',
      )
    }
  }

  private async loadAgentMessagesForLoop(sessionId: string) {
    const docs = await this.messageModel
      .find({ sessionId })
      .sort({ seq: 1 })
      .lean()

    const messages: AgentMessage[] = []
    for (const doc of docs) {
      const message = (doc.content as any)?.message
      if (!message || typeof message !== 'object') {
        continue
      }
      if (
        message.role === 'user' ||
        message.role === 'assistant' ||
        message.role === 'toolResult'
      ) {
        messages.push(message as AgentMessage)
      }
    }

    return messages
  }

  private createUserMessage(content: string): AgentMessage {
    return {
      role: 'user',
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
      timestamp: Date.now(),
    }
  }

  private async createAgentMessage(
    sessionId: string,
    seq: { value: number },
    message: AgentMessage,
    kind: AIAgentMessageKind,
  ) {
    const role = (message as any).role as
      | 'user'
      | 'assistant'
      | 'toolResult'
      | 'system'

    await this.createMessage(sessionId, seq, role, kind, {
      message,
    })
  }

  private async createMessage(
    sessionId: string,
    seq: { value: number },
    role: 'user' | 'assistant' | 'toolResult' | 'system',
    kind: AIAgentMessageKind,
    content: Record<string, unknown>,
  ) {
    const message = await this.messageModel.create({
      sessionId,
      seq: seq.value,
      role,
      kind,
      content,
    })

    seq.value += 1

    await this.emitToSession(sessionId, BusinessEvents.AI_AGENT_MESSAGE, {
      sessionId,
      message,
    })

    return message
  }

  private async getNextSeq(sessionId: string) {
    const doc = await this.messageModel
      .findOne({ sessionId })
      .sort({ seq: -1 })
      .select('seq')
      .lean()

    return (doc?.seq || 0) + 1
  }

  private resolvePiModel(config: AIAgentRuntimeConfigValue): {
    model: Model<any>
    selectedProvider: AIProviderConfig
  } {
    const enabledProviders = (config.providers || []).filter((provider) => {
      return provider.enabled && provider.apiKey?.trim()
    })

    if (!enabledProviders.length) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'No enabled provider with API key configured for AI agent',
      )
    }

    let selectedProvider: AIProviderConfig | undefined
    if (config.agentModel?.providerId) {
      selectedProvider = enabledProviders.find(
        (provider) => provider.id === config.agentModel!.providerId,
      )
    }

    selectedProvider ||= enabledProviders[0]

    const selectedModel =
      config.agentModel?.model?.trim() || selectedProvider.defaultModel

    const baseCost = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    }

    switch (selectedProvider.type) {
      case AIProviderType.Anthropic: {
        return {
          model: {
            id: selectedModel,
            name: selectedModel,
            api: 'anthropic-messages',
            provider: 'anthropic',
            baseUrl:
              this.normalizeEndpoint(selectedProvider.endpoint) ||
              'https://api.anthropic.com/v1',
            reasoning: true,
            input: ['text', 'image'],
            cost: baseCost,
            contextWindow: 200_000,
            maxTokens: 8_192,
          },
          selectedProvider,
        }
      }

      case AIProviderType.OpenRouter: {
        return {
          model: {
            id: selectedModel,
            name: selectedModel,
            api: 'openai-completions',
            provider: 'openrouter',
            baseUrl:
              this.normalizeEndpoint(selectedProvider.endpoint) ||
              'https://openrouter.ai/api/v1',
            reasoning: true,
            input: ['text', 'image'],
            cost: baseCost,
            contextWindow: 128_000,
            maxTokens: 16_384,
          },
          selectedProvider,
        }
      }

      case AIProviderType.OpenAICompatible: {
        const endpoint = this.normalizeEndpoint(selectedProvider.endpoint)
        if (!endpoint) {
          throw new BizException(
            ErrorCodeEnum.InvalidParameter,
            `Endpoint is required for provider: ${selectedProvider.id}`,
          )
        }
        return {
          model: {
            id: selectedModel,
            name: selectedModel,
            api: 'openai-completions',
            provider: selectedProvider.id,
            baseUrl: endpoint,
            reasoning: true,
            input: ['text', 'image'],
            cost: baseCost,
            contextWindow: 128_000,
            maxTokens: 16_384,
          },
          selectedProvider,
        }
      }

      case AIProviderType.OpenAI:
      default: {
        return {
          model: {
            id: selectedModel,
            name: selectedModel,
            api: 'openai-completions',
            provider: 'openai',
            baseUrl:
              this.normalizeEndpoint(selectedProvider.endpoint) ||
              'https://api.openai.com/v1',
            reasoning: true,
            input: ['text', 'image'],
            cost: baseCost,
            contextWindow: 128_000,
            maxTokens: 16_384,
          },
          selectedProvider,
        }
      }
    }
  }

  private createApiKeyResolver(providers: AIProviderConfig[]) {
    const enabledProviders = (providers || [])
      .filter((provider) => provider.enabled && provider.apiKey?.trim())
      .map((provider) => ({
        ...provider,
        apiKey: provider.apiKey.trim(),
      }))

    const keyByProviderId = new Map(
      enabledProviders.map((provider) => [provider.id, provider.apiKey]),
    )
    const keyByProviderType = new Map<AIProviderType, string>()

    for (const provider of enabledProviders) {
      if (!keyByProviderType.has(provider.type)) {
        keyByProviderType.set(provider.type, provider.apiKey)
      }
    }

    return (providerName: string) => {
      if (!providerName) {
        return undefined
      }

      if (keyByProviderId.has(providerName)) {
        return keyByProviderId.get(providerName)
      }

      switch (providerName) {
        case 'openrouter': {
          return keyByProviderType.get(AIProviderType.OpenRouter)
        }
        case 'anthropic': {
          return keyByProviderType.get(AIProviderType.Anthropic)
        }
        case 'openai': {
          return (
            keyByProviderType.get(AIProviderType.OpenAI) ||
            keyByProviderType.get(AIProviderType.OpenAICompatible)
          )
        }
        default: {
          return undefined
        }
      }
    }
  }

  private normalizeEndpoint(endpoint?: string) {
    if (!endpoint) {
      return undefined
    }

    let normalized = endpoint.trim().replace(/\/+$/, '')
    if (!normalized.endsWith('/v1')) {
      normalized = `${normalized}/v1`
    }
    return normalized
  }

  private buildSystemPrompt(connectors: AIAgentToolConnector[]) {
    const basePrompt = [...AI_AGENT_SYSTEM_PROMPT_LINES]

    if (connectors.length === 0) {
      return [
        ...basePrompt,
        'No tools are currently enabled for this session. Explain limitation and ask user to enable tools in admin config if needed.',
      ].join('\n')
    }

    const connectorPrompt = connectors
      .map(buildConnectorSystemPrompt)
      .join('\n\n')

    return [
      ...basePrompt,
      '',
      '<tool_capabilities>',
      connectorPrompt,
      '</tool_capabilities>',
    ].join('\n')
  }

  private safeJson(input: unknown) {
    try {
      const json = JSON.stringify(input, null, 2)
      if (!json) {
        return ''
      }
      if (json.length <= MAX_TOOL_OUTPUT_LENGTH) {
        return json
      }
      return `${json.slice(0, MAX_TOOL_OUTPUT_LENGTH)}\n...<truncated>`
    } catch {
      return String(input)
    }
  }

  private createActionResolutionMessage(
    action: AIAgentActionModel,
  ): AgentMessage {
    const summary = {
      actionId: action.id,
      toolName: action.toolName,
      state: action.state,
      result: action.result,
      error: action.error,
    }

    return this.createUserMessage(
      [
        'Tool confirmation resolved. Continue the previous task with this outcome:',
        this.safeJson(summary),
      ].join('\n'),
    )
  }

  private isPendingConfirmationToolEvent(event: unknown) {
    if (!event || typeof event !== 'object') {
      return false
    }
    if ((event as any).type !== 'tool_execution_end') {
      return false
    }

    const details = (event as any).result?.details
    return Boolean(
      details &&
      typeof details === 'object' &&
      (details as Record<string, unknown>).pendingConfirmation === true,
    )
  }

  private isAbortAssistantMessage(message: AgentMessage) {
    if (message.role !== 'assistant') {
      return false
    }

    const stopReason = (message as any).stopReason
    if (stopReason !== 'aborted') {
      return false
    }

    const errorMessage = (message as any).errorMessage
    if (typeof errorMessage !== 'string') {
      return true
    }

    return /aborted/i.test(errorMessage)
  }

  private async emitToSession(
    sessionId: string,
    event: BusinessEvents,
    payload: Record<string, unknown>,
  ) {
    await this.eventManager.emit(event, payload, {
      scope: EventScope.TO_ADMIN,
      gateway: {
        rooms: [getAgentSessionRoom(sessionId)],
      },
    })
  }
}
