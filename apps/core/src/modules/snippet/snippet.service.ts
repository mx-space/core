import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { load } from 'js-yaml'
import JSON5 from 'json5'
import qs from 'qs'

import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { EncryptUtil } from '~/utils/encrypt.util'
import { getRedisKey } from '~/utils/redis.util'

import { ServerlessService } from '../serverless/serverless.service'
import { SnippetRepository } from './snippet.repository'
import { SnippetType } from './snippet.schema'
import type { SnippetRow } from './snippet.types'

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
        throw new BizException(
          ErrorCodeEnum.InvalidParameter,
          `"${reference}" as reference is reserved`,
        )
      }
    }

    const reference = model.reference ?? 'root'
    const exists = await this.snippetRepository.countByNameReferenceMethod(
      model.name,
      reference,
      model.method ?? null,
    )
    if (exists > 0) {
      throw new BizException(ErrorCodeEnum.SnippetExists)
    }

    if (model.customPath) {
      const cpExists = await this.snippetRepository.countByCustomPath(
        model.customPath,
      )
      if (cpExists > 0) {
        throw new BizException(
          ErrorCodeEnum.InvalidParameter,
          'customPath already exists',
        )
      }
    }

    await this.validateTypeAndCleanup(model)

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
      reference,
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
    await this.validateTypeAndCleanup(newModel)

    const old = await this.snippetRepository.findById(id)
    if (!old) {
      throw new BizException(ErrorCodeEnum.SnippetNotFound)
    }

    if (
      old.type === SnippetType.Function &&
      newModel.type !== SnippetType.Function
    ) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        '`type` is not allowed to change if this snippet set to Function type.',
      )
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
          throw new BizException(
            ErrorCodeEnum.InvalidParameter,
            'customPath already exists',
          )
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
      reference: newModel.reference ?? 'root',
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
      throw new BizException(ErrorCodeEnum.SnippetNotFound)
    }

    if (old.reference === 'theme' || newModel.reference === 'theme') {
      await this.notifyAggregateThemeUpdate()
    }

    return this.transformLeanSnippetModel(updated)
  }

  async delete(id: string): Promise<void> {
    const doc = await this.snippetRepository.findById(id)
    if (!doc) {
      throw new BizException(ErrorCodeEnum.SnippetNotFound)
    }

    if (doc.type === SnippetType.Function && doc.reference === 'built-in') {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'built-in function snippet is not allowed to delete',
      )
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

  private async validateTypeAndCleanup(model: SnippetCreateInput) {
    switch (model.type) {
      case SnippetType.JSON: {
        try {
          JSON.parse(model.raw)
        } catch {
          throw new BizException(ErrorCodeEnum.SnippetInvalidJson)
        }
        break
      }
      case SnippetType.JSON5: {
        try {
          JSON5.parse(model.raw)
        } catch {
          throw new BizException(ErrorCodeEnum.SnippetInvalidJson5)
        }
        break
      }
      case SnippetType.YAML: {
        try {
          load(model.raw)
        } catch {
          throw new BizException(ErrorCodeEnum.SnippetInvalidYaml)
        }
        break
      }
      case SnippetType.Function: {
        const isValid = await this.serverlessService.isValidServerlessFunction(
          model.raw,
        )
        if (typeof isValid === 'string') {
          throw new BizException(ErrorCodeEnum.SnippetInvalidFunction, isValid)
        }
        if (!isValid) {
          throw new BizException(ErrorCodeEnum.SnippetInvalidFunction)
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
      throw new BizException(ErrorCodeEnum.SnippetNotFound)
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
      throw new BizException(ErrorCodeEnum.SnippetNotFound)
    }
    return doc
  }

  async getPublicSnippetByName(name: string, reference: string) {
    const snippet = await this.getSnippetByName(name, reference)
    if (snippet.type === SnippetType.Function) {
      throw new BizException(ErrorCodeEnum.SnippetNotFound)
    }

    if (snippet.private && !RequestContext.hasAdminAccess()) {
      throw new BizException(ErrorCodeEnum.SnippetPrivate)
    }

    const res = await this.attachSnippet(snippet)
    this.cacheSnippet(res, res.data)
    return res.data
  }

  async attachSnippet<T extends SnippetRow>(
    model: T,
  ): Promise<T & { data: any }> {
    if (!model) {
      throw new BizException(ErrorCodeEnum.SnippetNotFound)
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
    }

    return model as T & { data: any }
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
