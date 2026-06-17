import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { load } from 'js-yaml'
import JSON5 from 'json5'
import qs from 'qs'

import { RequestContext } from '~/common/contexts/request.context'
import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { EncryptUtil } from '~/utils/encrypt.util'
import { getRedisKey } from '~/utils/redis.util'

import { ServerlessService } from '../serverless/serverless.service'
import { SnippetRepository } from './snippet.repository'
import { SnippetType } from './snippet.schema'
import type { SnippetRow } from './snippet.types'
import type { PublicSkillView } from './snippet.views'
import { toPublicSkillView } from './snippet.views'

export interface SnippetCreateInput {
  type?: SnippetType
  private?: boolean
  raw: string
  name: string
  reference?: string
  comment?: string
  metatype?: string
  schema?: string
  method?: string | null
  customPath?: string | null
  secret?: string
  enable?: boolean
  builtIn?: boolean
  compiledCode?: string | null
}

export type SnippetUpdateInput = SnippetCreateInput

@Injectable()
export class SnippetService {
  constructor(
    private readonly snippetRepository: SnippetRepository,
    @Inject(forwardRef(() => ServerlessService))
    private readonly serverlessService: ServerlessService,
    private readonly redisService: RedisService,
    private readonly eventManager: EventManagerService,
    private readonly configsService: ConfigsService,
  ) {}

  get repository() {
    return this.snippetRepository
  }

  private readonly reservedReferenceKeys = ['system', 'built-in']

  private async notifyAggregateThemeUpdate() {
    await Promise.all([
      this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
        scope: EventScope.TO_SYSTEM,
      }),
      this.eventManager.emit(
        BusinessEvents.AGGREGATE_UPDATE,
        {
          source: 'theme',
          keys: ['theme'],
        },
        {
          scope: EventScope.TO_SYSTEM,
        },
      ),
    ])
  }

  async create(model: SnippetCreateInput): Promise<SnippetRow> {
    if (model.type === SnippetType.Function) {
      model.method ??= 'GET'
      model.enable ??= true

      const reference = model.reference ?? 'root'
      if (this.reservedReferenceKeys.includes(reference)) {
        throw createAppException(AppErrorCode.INVALID_PARAMETER, {
          message: `"${reference}" as reference is reserved`,
        })
      }
    }

    const reference = model.reference ?? 'root'
    const exists = await this.snippetRepository.countByNameReferenceMethod(
      model.name,
      reference,
      model.method ?? null,
    )
    if (exists > 0) {
      throw createAppException(AppErrorCode.SNIPPET_EXISTS)
    }

    if (model.customPath) {
      const cpExists = await this.snippetRepository.countByCustomPath(
        model.customPath,
      )
      if (cpExists > 0) {
        throw createAppException(AppErrorCode.INVALID_PARAMETER, {
          message: 'customPath already exists',
        })
      }
    }

    await this.validateTypeAndCleanup(model)

    if (
      model.type === SnippetType.Skill &&
      (!model.reference || model.reference === 'root')
    ) {
      model.reference = 'skill'
    }

    if (model.type === SnippetType.Function) {
      const compiled = await this.serverlessService.compileTypescriptCode(
        model.raw,
      )
      if (compiled) {
        model.compiledCode = compiled
      }
    }

    const created = await this.snippetRepository.create({
      type: model.type ?? SnippetType.JSON,
      private: model.private ?? false,
      raw: model.raw,
      name: model.name,
      reference: model.reference ?? reference,
      comment: model.comment ?? null,
      metatype: model.metatype ?? null,
      schema: model.schema ?? null,
      method: model.method ?? null,
      customPath: model.customPath ?? null,
      secret: model.secret ? EncryptUtil.encrypt(model.secret) : null,
      enable: model.enable ?? true,
      builtIn: model.builtIn ?? false,
      compiledCode: model.compiledCode ?? null,
    })

    if (reference === 'theme') {
      await this.notifyAggregateThemeUpdate()
    }

    return created
  }

  async update(id: string, newModel: SnippetUpdateInput): Promise<SnippetRow> {
    const reference = newModel.reference ?? 'root'
    await this.validateTypeAndCleanup(newModel)

    const old = await this.snippetRepository.findById(id)
    if (!old) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }

    if (
      old.type === SnippetType.Function &&
      newModel.type !== SnippetType.Function
    ) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message:
          '`type` is not allowed to change if this snippet set to Function type.',
      })
    }

    let mergedSecret = newModel.secret
    if (old.secret && newModel.secret) {
      const oldSecret = qs.parse(EncryptUtil.decrypt(old.secret))
      const newSecret = qs.parse(newModel.secret)

      for (const key in oldSecret) {
        if (!(key in newSecret)) {
          delete oldSecret[key]
        }
      }

      for (const key in newSecret) {
        if (newSecret[key] === '' && oldSecret[key] !== '') {
          delete newSecret[key]
        }
      }

      mergedSecret = qs.stringify({ ...oldSecret, ...newSecret })
    }

    if (newModel.customPath !== undefined) {
      if (newModel.customPath) {
        const cpExists = await this.snippetRepository.countByCustomPath(
          newModel.customPath,
          id,
        )
        if (cpExists > 0) {
          throw createAppException(AppErrorCode.INVALID_PARAMETER, {
            message: 'customPath already exists',
          })
        }
      }

      if (old.customPath) {
        await this.deleteCachedSnippetByCustomPath(old.customPath)
      }
    }

    await this.deleteCachedSnippet(old.reference, old.name)

    if (newModel.type === SnippetType.Function && newModel.raw) {
      const compiled = await this.serverlessService.compileTypescriptCode(
        newModel.raw,
      )
      if (compiled) {
        newModel.compiledCode = compiled
      }
    }

    const patch: Record<string, unknown> = {
      type: newModel.type ?? old.type,
      private: newModel.private ?? old.private,
      raw: newModel.raw,
      name: newModel.name,
      reference: newModel.reference ?? reference,
      comment: newModel.comment ?? null,
      metatype: newModel.metatype ?? null,
      schema: newModel.schema ?? null,
      method: newModel.method ?? null,
      enable: newModel.enable ?? old.enable,
      builtIn: newModel.builtIn ?? old.builtIn,
      compiledCode: newModel.compiledCode ?? old.compiledCode,
    }

    if (mergedSecret !== undefined) {
      patch.secret = mergedSecret ? EncryptUtil.encrypt(mergedSecret) : null
    }

    if ('customPath' in newModel) {
      patch.customPath = newModel.customPath || null
    }

    const updated = await this.snippetRepository.update(id, patch)
    if (!updated) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }

    if (old.reference === 'theme' || newModel.reference === 'theme') {
      await this.notifyAggregateThemeUpdate()
    }

    return this.transformLeanSnippetModel(updated)
  }

  async delete(id: string): Promise<void> {
    const doc = await this.snippetRepository.findById(id)
    if (!doc) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }

    if (doc.type === SnippetType.Function && doc.reference === 'built-in') {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'built-in function snippet is not allowed to delete',
      })
    }

    await this.snippetRepository.deleteById(id)

    await this.deleteCachedSnippet(doc.reference, doc.name)
    if (doc.customPath) {
      await this.deleteCachedSnippetByCustomPath(doc.customPath)
    }
    if (doc.reference === 'theme') {
      await this.notifyAggregateThemeUpdate()
    }
  }

  private parseSkillFrontmatter(raw: string): {
    name: string
    description: string
    rest: Record<string, unknown>
  } {
    const match = raw.match(/^---[\t ]*\r?\n(.*?)\r?\n---[\t ]*\r?\n/s)
    if (!match) {
      throw createAppException(AppErrorCode.SNIPPET_SKILL_INVALID_FRONTMATTER)
    }
    let parsed: unknown
    try {
      parsed = load(match[1])
    } catch {
      throw createAppException(AppErrorCode.SNIPPET_SKILL_INVALID_FRONTMATTER)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw createAppException(AppErrorCode.SNIPPET_SKILL_INVALID_FRONTMATTER)
    }
    const { name, description, ...rest } = parsed as Record<string, unknown>
    if (typeof name !== 'string') {
      throw createAppException(AppErrorCode.SNIPPET_SKILL_NAME_MISMATCH)
    }
    if (!description || typeof description !== 'string') {
      throw createAppException(AppErrorCode.SNIPPET_SKILL_DESCRIPTION_REQUIRED)
    }
    return { name, description, rest }
  }

  private async validateTypeAndCleanup(model: SnippetCreateInput) {
    switch (model.type) {
      case SnippetType.JSON: {
        try {
          JSON.parse(model.raw)
        } catch {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_JSON)
        }
        break
      }
      case SnippetType.JSON5: {
        try {
          JSON5.parse(model.raw)
        } catch {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_JSON5)
        }
        break
      }
      case SnippetType.YAML: {
        try {
          load(model.raw)
        } catch {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_YAML)
        }
        break
      }
      case SnippetType.Function: {
        const isValid = await this.serverlessService.isValidServerlessFunction(
          model.raw,
        )
        if (typeof isValid === 'string') {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_FUNCTION, {
            extra: isValid,
          })
        }
        if (!isValid) {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_FUNCTION)
        }
        break
      }
      case SnippetType.Skill: {
        const fm = this.parseSkillFrontmatter(model.raw)
        if (fm.name !== model.name) {
          throw createAppException(AppErrorCode.SNIPPET_SKILL_NAME_MISMATCH)
        }
        model.comment = fm.description
        if (!model.customPath) {
          model.customPath = `sk/${model.name}`
        }
        break
      }

      default: {
        break
      }
    }
    if (model.type !== SnippetType.Function) {
      delete model.enable
      delete model.method
      delete model.secret
    }
  }

  async getSnippetById(id: string): Promise<SnippetRow> {
    const doc = await this.snippetRepository.findById(id)
    if (!doc) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }
    return this.transformLeanSnippetModel(doc)
  }

  private transformLeanSnippetModel(snippet: SnippetRow): SnippetRow {
    const next = { ...snippet }
    if (snippet.type === SnippetType.Function && snippet.secret) {
      const secretObj = qs.parse(EncryptUtil.decrypt(snippet.secret))
      for (const key in secretObj) {
        secretObj[key] = ''
      }
      next.secret = secretObj as any
    } else if (snippet.secret) {
      // Never expose stored encrypted secret payload outside Function type.
      next.secret = null
    }
    return next
  }

  transformLeanSnippet(snippet: SnippetRow): SnippetRow {
    return this.transformLeanSnippetModel(snippet)
  }

  transformLeanSnippetList(rows: SnippetRow[]): SnippetRow[] {
    return rows.map((row) => this.transformLeanSnippetModel(row))
  }

  async getSnippetByName(name: string, reference: string): Promise<SnippetRow> {
    const doc = await this.snippetRepository.findPublicByName(name, reference)
    if (!doc) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }
    return doc
  }

  async getPublicSnippetByName(name: string, reference: string) {
    const snippet = await this.getSnippetByName(name, reference)
    if (snippet.type === SnippetType.Function) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }

    if (snippet.private && !RequestContext.hasAdminAccess()) {
      throw createAppException(AppErrorCode.SNIPPET_PRIVATE)
    }

    const res = await this.attachSnippet(snippet)
    this.cacheSnippet(res, res.data)
    return res.data
  }

  async attachSnippet<T extends SnippetRow>(
    model: T,
  ): Promise<T & { data: any }> {
    if (!model) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }
    switch (model.type) {
      case SnippetType.JSON: {
        Reflect.set(model, 'data', JSON.parse(model.raw))
        break
      }
      case SnippetType.JSON5: {
        Reflect.set(model, 'data', JSON5.parse(model.raw))
        break
      }
      case SnippetType.YAML: {
        Reflect.set(model, 'data', load(model.raw))
        break
      }
      case SnippetType.Text: {
        Reflect.set(model, 'data', model.raw)
        break
      }
      case SnippetType.Skill: {
        Reflect.set(model, 'data', model.raw)
        break
      }
    }

    return model as T & { data: any }
  }

  async findSkillsByIds(
    ids: string[],
    options: { includePrivate?: boolean } = {},
  ): Promise<PublicSkillView[]> {
    if (ids.length === 0) return []
    const rows = await this.snippetRepository.findSkillsByIds(
      ids,
      options.includePrivate ?? false,
    )
    const urlConfig = await this.configsService.get('url')
    const serverUrl = urlConfig?.serverUrl ?? ''
    const rowMap = new Map(rows.map((r) => [String(r.id), r]))
    return ids
      .map((id) => rowMap.get(id))
      .filter((r): r is SnippetRow => r !== undefined)
      .map((r) => toPublicSkillView(r, serverUrl))
  }

  private snippetCacheKey(prefix: string, isPrivate: boolean) {
    return `${prefix}:${isPrivate ? 'private' : ''}`
  }

  private async cacheRedisValue(key: string, value: any) {
    const client = this.redisService.getClient()
    await client.hset(
      getRedisKey(RedisKeys.SnippetCache),
      key,
      typeof value !== 'string' ? JSON.stringify(value) : value,
    )
  }

  private async deleteCachedKeyVariants(prefix: string) {
    const client = this.redisService.getClient()
    const cacheKey = getRedisKey(RedisKeys.SnippetCache)
    await Promise.all(
      [`${prefix}:`, `${prefix}:private`].map((key) =>
        client.hdel(cacheKey, key),
      ),
    )
  }

  async cacheSnippet(model: SnippetRow, value: any) {
    const { reference, name } = model
    await this.cacheRedisValue(
      this.snippetCacheKey(`${reference}:${name}`, !!model.private),
      value,
    )
  }

  async getCachedSnippet(
    reference: string,
    name: string,
    accessType: 'public' | 'private',
  ) {
    const key = this.snippetCacheKey(
      `${reference}:${name}`,
      accessType === 'private',
    )
    const client = this.redisService.getClient()
    return client.hget(getRedisKey(RedisKeys.SnippetCache), key)
  }

  async deleteCachedSnippet(reference: string, name: string) {
    await this.deleteCachedKeyVariants(`${reference}:${name}`)
  }

  // --- customPath methods ---

  async getSnippetByCustomPath(customPath: string): Promise<SnippetRow | null> {
    const row = await this.snippetRepository.findByCustomPath(customPath)
    if (!row) return null
    if (row.type === SnippetType.Function) return null
    return row
  }

  async getFunctionSnippetByCustomPath(
    customPath: string,
    method: string,
  ): Promise<SnippetRow | null> {
    return this.snippetRepository.findFunctionByCustomPath(customPath, method)
  }

  async getFunctionSnippetByCustomPathPrefix(
    candidatePaths: string[],
    method: string,
  ): Promise<SnippetRow | null> {
    return this.snippetRepository.findFunctionByCustomPathPrefix(
      candidatePaths,
      method,
    )
  }

  async cacheSnippetByCustomPath(
    customPath: string,
    isPrivate: boolean,
    value: any,
  ) {
    await this.cacheRedisValue(
      this.snippetCacheKey(`cp:${customPath}`, isPrivate),
      value,
    )
  }

  async getCachedSnippetByCustomPath(
    customPath: string,
    accessType: 'public' | 'private',
  ) {
    const key = this.snippetCacheKey(
      `cp:${customPath}`,
      accessType === 'private',
    )
    const client = this.redisService.getClient()
    return client.hget(getRedisKey(RedisKeys.SnippetCache), key)
  }

  async deleteCachedSnippetByCustomPath(customPath: string) {
    await this.deleteCachedKeyVariants(`cp:${customPath}`)
  }
}
