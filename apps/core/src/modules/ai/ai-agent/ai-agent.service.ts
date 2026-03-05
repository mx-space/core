import { type AgentMessage, type AgentTool } from '@mariozechner/pi-agent-core'
import { Injectable, Logger } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'

import type { AIProviderConfig } from '../ai.types'
import {
  type SendAIAgentMessageInput,
  type UpsertAIAgentConfigInput,
} from './ai-agent.schema'
import {
  AIAgentActionState,
  AIAgentEventType,
  AIAgentMessageKind,
  AIAgentOperationMode,
  AIAgentOperationStatus,
  type AIAgentRuntimeConfigValue,
  AIAgentSessionStatus,
  type AIAgentToolId,
  BUILTIN_AGENT_TOOL_IDS,
  getAgentSessionRoom,
} from './ai-agent.types'
import { AIAgentActionModel } from './ai-agent-action.model'
import { AIAgentEventModel } from './ai-agent-event.model'
import { AIAgentMessageModel } from './ai-agent-message.model'
import { AIAgentOperationModel } from './ai-agent-operation.model'
import { AIAgentRuntimeConfigModel } from './ai-agent-runtime-config.model'
import { AIAgentSessionModel } from './ai-agent-session.model'
import { AI_AGENT_SYSTEM_PROMPT_LINES } from './ai-agent-system-prompt'
import { AIAgentContextEngineService } from './context-engine/ai-agent-context-engine.service'
import { AIAgentSessionLockService } from './infra/ai-agent-session-lock.service'
import { AIAgentModelFactoryService } from './model-runtime/ai-agent-model-factory.service'
import { AIAgentRuntimeService } from './runtime/ai-agent-runtime.service'
import {
  type AIAgentToolConnector,
  buildConnectorSystemPrompt,
} from './tools/connector.types'
import { executeMongoConfirmedAction } from './tools/connectors/mongodb'
import { executeShellConfirmedAction } from './tools/connectors/shell'
import { AIAgentToolsEngineService } from './tools-engine/ai-agent-tools-engine.service'

const AGENT_RUNTIME_CONFIG_KEY = 'default'
const MAX_TOOL_OUTPUT_LENGTH = 16_000

type AIAgentLoopStart =
  | { mode: AIAgentOperationMode.Prompt; input: string }
  | { mode: AIAgentOperationMode.Continue; triggerActionId?: string }

@Injectable()
export class AIAgentService {
  private readonly logger = new Logger(AIAgentService.name)
  private readonly runningSessions = new Map<string, Promise<void>>()
  private readonly pendingContinueBySession = new Map<
    string,
    string | undefined
  >()

  constructor(
    @InjectModel(AIAgentRuntimeConfigModel)
    private readonly runtimeConfigModel: MongooseModel<AIAgentRuntimeConfigModel>,
    @InjectModel(AIAgentSessionModel)
    private readonly sessionModel: MongooseModel<AIAgentSessionModel>,
    @InjectModel(AIAgentOperationModel)
    private readonly operationModel: MongooseModel<AIAgentOperationModel>,
    @InjectModel(AIAgentEventModel)
    private readonly eventModel: MongooseModel<AIAgentEventModel>,
    @InjectModel(AIAgentMessageModel)
    private readonly messageModel: MongooseModel<AIAgentMessageModel>,
    @InjectModel(AIAgentActionModel)
    private readonly actionModel: MongooseModel<AIAgentActionModel>,
    private readonly databaseService: DatabaseService,
    private readonly eventManager: EventManagerService,
    private readonly contextEngine: AIAgentContextEngineService,
    private readonly modelFactory: AIAgentModelFactoryService,
    private readonly runtimeService: AIAgentRuntimeService,
    private readonly toolsEngine: AIAgentToolsEngineService,
    private readonly sessionLockService: AIAgentSessionLockService,
  ) {}

  async getRuntimeConfig(): Promise<AIAgentRuntimeConfigValue> {
    const doc = await this.runtimeConfigModel
      .findOne({ key: AGENT_RUNTIME_CONFIG_KEY })
      .lean()

    if (!doc) {
      return {
        providers: [],
        enabledTools: [...BUILTIN_AGENT_TOOL_IDS],
        maxSteps: 20,
        historyWindow: 80,
        contextCharBudget: 200_000,
      }
    }

    return {
      providers: (doc.providers || []) as AIProviderConfig[],
      agentModel: doc.agentModel,
      enabledTools: this.normalizeEnabledToolIds(
        doc.enabledTools as string[] | undefined,
      ),
      maxSteps: doc.maxSteps || 20,
      historyWindow: doc.historyWindow || 80,
      contextCharBudget: doc.contextCharBudget || 200_000,
    }
  }

  async upsertRuntimeConfig(input: UpsertAIAgentConfigInput) {
    const providers = input.providers.map((provider) => ({
      ...provider,
      apiKey: provider.apiKey.trim(),
      endpoint: provider.endpoint?.trim() || undefined,
    }))

    const enabledTools = this.normalizeEnabledToolIds(
      input.enabledTools as string[] | undefined,
    )

    const doc = await this.runtimeConfigModel.findOneAndUpdate(
      { key: AGENT_RUNTIME_CONFIG_KEY },
      {
        $set: {
          key: AGENT_RUNTIME_CONFIG_KEY,
          providers,
          agentModel: input.agentModel,
          enabledTools,
          maxSteps: input.maxSteps || 20,
          historyWindow: input.historyWindow || 80,
          contextCharBudget: input.contextCharBudget || 200_000,
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
      enabledTools: this.normalizeEnabledToolIds(
        doc.enabledTools as string[] | undefined,
      ),
      maxSteps: doc.maxSteps,
      historyWindow: doc.historyWindow,
      contextCharBudget: doc.contextCharBudget,
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

    const latestOperation = await this.operationModel
      .findOne({ sessionId })
      .sort({ created: -1 })
      .lean()

    return {
      session,
      pendingActions,
      latestOperation,
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

    const queued = await this.queueOperation(sessionId, {
      mode: AIAgentOperationMode.Prompt,
      input: body.content,
    })

    if (!queued.started) {
      throw new BizException(
        ErrorCodeEnum.AIProcessing,
        'Agent is already running for this session',
      )
    }

    return {
      accepted: true,
      running: true,
      operationId: queued.operationId,
    }
  }

  async confirmAction(actionId: string) {
    const action = await this.actionModel.findOneAndUpdate(
      {
        _id: actionId,
        state: AIAgentActionState.Pending,
      },
      {
        $set: {
          state: AIAgentActionState.Confirmed,
          updated: new Date(),
        },
      },
      { new: true },
    )

    if (!action) {
      const current = await this.actionModel.findById(actionId).lean()
      if (!current) {
        throw new BizException(
          ErrorCodeEnum.ResourceNotFound,
          'Action not found',
        )
      }

      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        `Action is not pending: ${current.state}`,
      )
    }

    let errorMessage: string | undefined

    try {
      const result = await this.executeConfirmedAction(
        action.toolName,
        action.arguments,
      )
      await this.actionModel.updateOne(
        {
          _id: action.id,
          state: AIAgentActionState.Confirmed,
        },
        {
          $set: {
            state: AIAgentActionState.Executed,
            result,
            updated: new Date(),
          },
        },
      )
    } catch (error) {
      errorMessage = (error as Error)?.message || 'Unknown execution error'
      await this.actionModel.updateOne(
        {
          _id: action.id,
          state: AIAgentActionState.Confirmed,
        },
        {
          $set: {
            state: AIAgentActionState.Cancelled,
            error: errorMessage,
            result: {
              error: errorMessage,
            },
            updated: new Date(),
          },
        },
      )
    }

    const latest = await this.actionModel.findById(action.id).lean()
    if (!latest) {
      throw new BizException(ErrorCodeEnum.ResourceNotFound, 'Action not found')
    }

    const seq = { value: await this.getNextMessageSeq(action.sessionId) }
    const confirmContent = {
      actionId: latest.id,
      state: latest.state,
      toolName: latest.toolName,
      result: latest.result,
      error: latest.error,
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
      this.createActionResolutionMessage(
        latest.state,
        latest.id,
        latest.toolName,
        latest.result,
        latest.error,
      ),
      AIAgentMessageKind.ConfirmResult,
    )

    await this.emitToSession(
      action.sessionId,
      BusinessEvents.AI_AGENT_CONFIRM_RESULT,
      confirmContent,
    )

    await this.appendEvent(
      latest.operationId,
      action.sessionId,
      AIAgentEventType.ConfirmResult,
      confirmContent,
    )

    await this.maybeResumeAfterConfirmations(action.sessionId, latest.id)

    return {
      success: !errorMessage,
      action: latest,
    }
  }

  async rejectAction(actionId: string) {
    const action = await this.actionModel.findOneAndUpdate(
      {
        _id: actionId,
        state: AIAgentActionState.Pending,
      },
      {
        $set: {
          state: AIAgentActionState.Rejected,
          updated: new Date(),
        },
      },
      { new: true },
    )

    if (!action) {
      const current = await this.actionModel.findById(actionId).lean()
      if (!current) {
        throw new BizException(
          ErrorCodeEnum.ResourceNotFound,
          'Action not found',
        )
      }

      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        `Action is not pending: ${current.state}`,
      )
    }

    const seq = { value: await this.getNextMessageSeq(action.sessionId) }
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
      this.createActionResolutionMessage(
        action.state,
        action.id,
        action.toolName,
        action.result,
        action.error,
      ),
      AIAgentMessageKind.ConfirmResult,
    )

    await this.emitToSession(
      action.sessionId,
      BusinessEvents.AI_AGENT_CONFIRM_RESULT,
      rejectContent,
    )

    await this.appendEvent(
      action.operationId,
      action.sessionId,
      AIAgentEventType.ConfirmResult,
      rejectContent,
    )

    await this.maybeResumeAfterConfirmations(action.sessionId, action.id)

    return {
      success: true,
      action,
    }
  }

  private async queueOperation(sessionId: string, start: AIAgentLoopStart) {
    if (this.runningSessions.has(sessionId)) {
      return {
        started: false,
      } as const
    }

    const operation = await this.operationModel.create({
      sessionId,
      mode: start.mode,
      prompt:
        start.mode === AIAgentOperationMode.Prompt ? start.input : undefined,
      status: AIAgentOperationStatus.Queued,
      triggerActionId:
        start.mode === AIAgentOperationMode.Continue
          ? start.triggerActionId
          : undefined,
    })

    const started = this.startAgentLoop(sessionId, operation.id, start)
    if (!started) {
      await this.operationModel.updateOne(
        { _id: operation.id },
        {
          $set: {
            status: AIAgentOperationStatus.Cancelled,
            error: 'Session already running',
            endedAt: new Date(),
          },
        },
      )

      return {
        started: false,
      } as const
    }

    return {
      started: true,
      operationId: operation.id,
    } as const
  }

  private startAgentLoop(
    sessionId: string,
    operationId: string,
    start: AIAgentLoopStart,
  ) {
    if (this.runningSessions.has(sessionId)) {
      return false
    }

    const task = this.runAgentLoop(sessionId, operationId, start)
      .catch((error) => {
        this.logger.error(
          `runAgentLoop failed: mode=${start.mode} session=${sessionId} operation=${operationId} error=${error?.message || error}`,
          error?.stack,
        )
      })
      .finally(async () => {
        this.runningSessions.delete(sessionId)
        await this.tryDrainPendingContinue(sessionId)
      })

    this.runningSessions.set(sessionId, task)
    return true
  }

  private async maybeResumeAfterConfirmations(
    sessionId: string,
    triggerActionId: string,
  ) {
    const pendingActionCount = await this.actionModel.countDocuments({
      sessionId,
      state: AIAgentActionState.Pending,
    })
    if (pendingActionCount > 0) {
      return
    }

    const queued = await this.queueOperation(sessionId, {
      mode: AIAgentOperationMode.Continue,
      triggerActionId,
    })

    if (!queued.started) {
      this.pendingContinueBySession.set(sessionId, triggerActionId)
    }
  }

  private async tryDrainPendingContinue(sessionId: string) {
    if (!this.pendingContinueBySession.has(sessionId)) {
      return
    }

    if (this.runningSessions.has(sessionId)) {
      return
    }

    const pendingActionCount = await this.actionModel.countDocuments({
      sessionId,
      state: AIAgentActionState.Pending,
    })

    if (pendingActionCount > 0) {
      return
    }

    const triggerActionId = this.pendingContinueBySession.get(sessionId)
    this.pendingContinueBySession.delete(sessionId)

    const queued = await this.queueOperation(sessionId, {
      mode: AIAgentOperationMode.Continue,
      triggerActionId,
    })

    if (!queued.started) {
      this.pendingContinueBySession.set(sessionId, triggerActionId)
    }
  }

  private async runAgentLoop(
    sessionId: string,
    operationId: string,
    start: AIAgentLoopStart,
  ) {
    const lock = await this.sessionLockService.acquire(sessionId)
    if (!lock) {
      await this.operationModel.updateOne(
        { _id: operationId },
        {
          $set: {
            status: AIAgentOperationStatus.Cancelled,
            error: 'Session lock is held by another worker',
            endedAt: new Date(),
          },
        },
      )
      return
    }

    const lockRenewTimer = setInterval(() => {
      this.sessionLockService
        .renew(sessionId, lock.token)
        .catch(() => undefined)
    }, 30_000)

    const eventSeq = { value: 1 }

    try {
      const runtime = await this.getRuntimeConfig()
      const contextResult = await this.contextEngine.buildContext({
        sessionId,
        historyWindow: runtime.historyWindow,
        contextCharBudget: runtime.contextCharBudget,
      })

      await this.operationModel.updateOne(
        { _id: operationId },
        {
          $set: {
            status: AIAgentOperationStatus.Running,
            startedAt: new Date(),
            error: undefined,
          },
        },
      )

      await this.sessionModel.updateOne(
        { _id: sessionId },
        {
          $set: {
            updated: new Date(),
            lastOperationId: operationId,
          },
        },
      )

      await this.emitToSession(
        sessionId,
        BusinessEvents.AI_AGENT_SESSION_STATE,
        {
          sessionId,
          state: 'running',
        },
      )

      await this.appendEventWithSeq(
        operationId,
        sessionId,
        eventSeq,
        AIAgentEventType.SessionState,
        { state: 'running' },
      )

      if (contextResult.compressed) {
        await this.appendEventWithSeq(
          operationId,
          sessionId,
          eventSeq,
          AIAgentEventType.Compression,
          {
            summary: contextResult.summary,
            applied: true,
          },
        )
      }

      const seq = {
        value: await this.getNextMessageSeq(sessionId),
      }

      if (start.mode === AIAgentOperationMode.Prompt) {
        await this.createAgentMessage(
          sessionId,
          seq,
          this.createUserMessage(start.input),
          AIAgentMessageKind.User,
        )
      }

      const { model, selectedProvider } =
        this.modelFactory.resolvePiModel(runtime)
      const apiKeyResolver = this.modelFactory.createApiKeyResolver(
        runtime.providers,
      )

      const connectors = this.toolsEngine.resolveEnabled(runtime.enabledTools, {
        db: this.databaseService.db,
        safeJson: (input) => this.safeJson(input),
        createPendingAction: (sid, msgSeq, toolName, args, dryRunPreview) => {
          return this.createPendingAction(
            operationId,
            eventSeq,
            sid,
            msgSeq,
            toolName,
            args,
            dryRunPreview,
          )
        },
      })

      const tools = this.buildAgentTools(connectors, sessionId, seq)

      const runtimeResult = await this.runtimeService.executeLoop({
        mode: start.mode,
        prompt:
          start.mode === AIAgentOperationMode.Prompt ? start.input : undefined,
        maxSteps: runtime.maxSteps,
        model,
        getApiKey: (providerName) => {
          return apiKeyResolver(providerName) || selectedProvider.apiKey
        },
        messages: contextResult.messages,
        tools,
        systemPrompt: this.buildSystemPrompt(connectors),
        onDelta: async (delta) => {
          await this.emitToSession(sessionId, BusinessEvents.AI_AGENT_MESSAGE, {
            sessionId,
            kind: 'assistant_delta',
            delta,
          })

          await this.appendEventWithSeq(
            operationId,
            sessionId,
            eventSeq,
            AIAgentEventType.MessageDelta,
            { delta },
          )
        },
        onToolEvent: async (event) => {
          await this.emitToSession(
            sessionId,
            BusinessEvents.AI_AGENT_TOOL_EVENT,
            {
              sessionId,
              event,
            },
          )

          await this.appendEventWithSeq(
            operationId,
            sessionId,
            eventSeq,
            AIAgentEventType.ToolEvent,
            { event },
          )
        },
        onMessage: async (message) => {
          const kind =
            message.role === 'assistant'
              ? AIAgentMessageKind.Assistant
              : AIAgentMessageKind.ToolResult

          await this.createAgentMessage(sessionId, seq, message, kind)

          await this.appendEventWithSeq(
            operationId,
            sessionId,
            eventSeq,
            AIAgentEventType.MessagePersisted,
            {
              role: message.role,
              kind,
            },
          )
        },
      })

      const reachedStepLimit = runtimeResult.reason === 'max_steps'
      const maxStepsMessage = reachedStepLimit
        ? `Agent stopped after reaching maxSteps=${runtime.maxSteps}.`
        : undefined

      if (maxStepsMessage) {
        await this.createMessage(
          sessionId,
          seq,
          'system',
          AIAgentMessageKind.RuntimeError,
          {
            message: maxStepsMessage,
          },
        )

        await this.appendEventWithSeq(
          operationId,
          sessionId,
          eventSeq,
          AIAgentEventType.RuntimeError,
          {
            message: maxStepsMessage,
          },
        )
      }

      await this.operationModel.updateOne(
        { _id: operationId },
        {
          $set: {
            status: runtimeResult.pausedForHuman
              ? AIAgentOperationStatus.WaitingHuman
              : reachedStepLimit
                ? AIAgentOperationStatus.Cancelled
                : AIAgentOperationStatus.Done,
            stepCount: runtimeResult.stepCount,
            error: maxStepsMessage,
            endedAt: new Date(),
          },
        },
      )
    } catch (error) {
      const message = (error as Error)?.message || 'Runtime error'
      await this.operationModel.updateOne(
        { _id: operationId },
        {
          $set: {
            status: AIAgentOperationStatus.Error,
            error: message,
            endedAt: new Date(),
          },
        },
      )

      const seq = { value: await this.getNextMessageSeq(sessionId) }
      await this.createMessage(
        sessionId,
        seq,
        'system',
        AIAgentMessageKind.RuntimeError,
        {
          message,
        },
      )

      await this.appendEventWithSeq(
        operationId,
        sessionId,
        eventSeq,
        AIAgentEventType.RuntimeError,
        {
          message,
          stack: (error as Error)?.stack,
        },
      )

      throw error
    } finally {
      clearInterval(lockRenewTimer)
      await this.sessionLockService.release(sessionId, lock.token)

      await this.emitToSession(
        sessionId,
        BusinessEvents.AI_AGENT_SESSION_STATE,
        {
          sessionId,
          state: 'idle',
        },
      )

      await this.appendEventWithSeq(
        operationId,
        sessionId,
        eventSeq,
        AIAgentEventType.SessionState,
        { state: 'idle' },
      )
    }
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

  private async executeConfirmedAction(
    toolName: string,
    args: Record<string, unknown>,
  ) {
    if (toolName === 'mongodb') {
      return executeMongoConfirmedAction(this.databaseService.db, args)
    }

    if (toolName === 'shell') {
      return executeShellConfirmedAction(args)
    }

    throw new Error(`Unsupported action tool: ${toolName}`)
  }

  private async createPendingAction(
    operationId: string,
    eventSeq: { value: number },
    sessionId: string,
    seq: { value: number },
    toolName: string,
    args: Record<string, unknown>,
    dryRunPreview: Record<string, unknown>,
  ) {
    const action = await this.actionModel.create({
      sessionId,
      operationId,
      toolName,
      arguments: args,
      state: AIAgentActionState.Pending,
      dryRunPreview,
      updated: new Date(),
    })

    const payload = {
      actionId: action.id,
      operationId,
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

    await this.appendEventWithSeq(
      operationId,
      sessionId,
      eventSeq,
      AIAgentEventType.ConfirmRequest,
      payload,
    )

    await this.emitToSession(
      sessionId,
      BusinessEvents.AI_AGENT_CONFIRM_REQUEST,
      payload,
    )

    return action
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

  private async appendEvent(
    operationId: string,
    sessionId: string,
    type: AIAgentEventType,
    payload: Record<string, unknown>,
  ) {
    const seq = await this.getNextEventSeq(operationId)

    await this.eventModel.create({
      operationId,
      sessionId,
      seq,
      type,
      payload,
    })
  }

  private async appendEventWithSeq(
    operationId: string,
    sessionId: string,
    seq: { value: number },
    type: AIAgentEventType,
    payload: Record<string, unknown>,
  ) {
    await this.eventModel.create({
      operationId,
      sessionId,
      seq: seq.value,
      type,
      payload,
    })

    seq.value += 1
  }

  private async getNextMessageSeq(sessionId: string) {
    const doc = await this.messageModel
      .findOne({ sessionId })
      .sort({ seq: -1 })
      .select('seq')
      .lean()

    return (doc?.seq || 0) + 1
  }

  private async getNextEventSeq(operationId: string) {
    const doc = await this.eventModel
      .findOne({ operationId })
      .sort({ seq: -1 })
      .select('seq')
      .lean()

    return (doc?.seq || 0) + 1
  }

  private normalizeEnabledToolIds(enabledTools: readonly string[] | undefined) {
    if (!Array.isArray(enabledTools)) {
      return [...BUILTIN_AGENT_TOOL_IDS]
    }

    return Array.from(
      new Set(
        enabledTools.filter((id): id is AIAgentToolId => {
          return BUILTIN_AGENT_TOOL_IDS.includes(id as AIAgentToolId)
        }),
      ),
    )
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
    state: string,
    actionId: string,
    toolName: string,
    result?: Record<string, unknown>,
    error?: string,
  ): AgentMessage {
    const summary = {
      actionId,
      toolName,
      state,
      result,
      error,
    }

    return this.createUserMessage(
      [
        'Tool confirmation resolved. Continue the previous task with this outcome:',
        this.safeJson(summary),
      ].join('\n'),
    )
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
