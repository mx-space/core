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
import type {
  SkillBundleView,
  SnippetObjectView,
  SnippetRow,
  SnippetVfsList,
} from './snippet.types'
import {
  deriveSkillName,
  normalizeSkillPath,
  stripSkillSuffix,
  toSkillBundleView,
} from './snippet.views'

export interface SnippetCreateInput {
  type?: SnippetType
  private?: boolean
  raw: string
  path: string
  comment?: string | null
  metatype?: string | null
  schema?: string | null
  method?: string | null
  secret?: string | null
  enable?: boolean
  builtIn?: boolean
  compiledCode?: string | null
}

export type SnippetUpdateInput = Partial<SnippetCreateInput> & { path?: string }

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

  private normalizePath(path: string) {
    return path.replaceAll(/^\/+|\/+$/g, '')
  }

  private isThemePath(path: string) {
    return path === 'theme' || path.startsWith('theme/')
  }

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

  private toObjectView(row: SnippetRow): SnippetObjectView {
    return {
      id: row.id,
      path: row.path,
      type: row.type,
      comment: row.comment,
      private: row.private,
      enable: row.enable,
      method: row.method,
      updatedAt: row.updatedAt,
    }
  }

  async listVfs(options: {
    prefix?: string
    recursive?: boolean
    limit?: number
  }): Promise<SnippetVfsList> {
    const prefix = options.prefix ? this.normalizePath(options.prefix) : ''
    const effectivePrefix =
      prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix
    const rows = await this.snippetRepository.findByPrefix(
      effectivePrefix,
      options.limit,
    )
    if (options.recursive) {
      return {
        prefix: effectivePrefix,
        objects: rows.map((row) => this.toObjectView(row)),
        commonPrefixes: [],
      }
    }

    const objects: SnippetObjectView[] = []
    const commonPrefixes = new Set<string>()
    for (const row of rows) {
      const rest = row.path.slice(effectivePrefix.length)
      const slashIndex = rest.indexOf('/')
      if (slashIndex === -1) {
        objects.push(this.toObjectView(row))
      } else {
        commonPrefixes.add(`${effectivePrefix}${rest.slice(0, slashIndex + 1)}`)
      }
    }

    return {
      prefix: effectivePrefix,
      objects,
      commonPrefixes: [...commonPrefixes].sort(),
    }
  }

  async create(model: SnippetCreateInput): Promise<SnippetRow> {
    const next = await this.prepareInput(model)
    const exists = await this.snippetRepository.countByPathMethod(
      next.path,
      next.method ?? null,
    )
    if (exists > 0) {
      throw createAppException(AppErrorCode.SNIPPET_EXISTS)
    }

    const created = await this.snippetRepository.create(next)
    if (this.isThemePath(created.path)) {
      await this.notifyAggregateThemeUpdate()
    }
    return created
  }

  async upsertByPath(model: SnippetCreateInput): Promise<SnippetRow> {
    const next = await this.prepareInput(model)
    const old = await this.snippetRepository.findAnyByPath(
      next.path,
      next.method ?? null,
    )
    if (old) {
      await this.deleteCachedSnippetByPath(old.path)
    }
    const saved = await this.snippetRepository.upsertByPath(next)
    if (this.isThemePath(saved.path) || (old && this.isThemePath(old.path))) {
      await this.notifyAggregateThemeUpdate()
    }
    return this.transformLeanSnippetModel(saved)
  }

  async update(id: string, newModel: SnippetUpdateInput): Promise<SnippetRow> {
    const old = await this.snippetRepository.findById(id)
    if (!old) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }

    const merged: SnippetCreateInput = {
      type: newModel.type ?? (old.type as SnippetType),
      private: newModel.private ?? old.private,
      raw: newModel.raw ?? old.raw,
      path: newModel.path ?? old.path,
      comment: newModel.comment ?? old.comment,
      metatype: newModel.metatype ?? old.metatype,
      schema: newModel.schema ?? old.schema,
      method: newModel.method ?? old.method,
      secret: newModel.secret ?? undefined,
      enable: newModel.enable ?? old.enable,
      builtIn: newModel.builtIn ?? old.builtIn,
      compiledCode: newModel.compiledCode ?? old.compiledCode,
    }

    if (
      old.type === SnippetType.Function &&
      merged.type !== SnippetType.Function
    ) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message:
          '`type` is not allowed to change if this snippet set to Function type.',
      })
    }

    if (merged.path !== old.path || (merged.method ?? null) !== old.method) {
      const exists = await this.snippetRepository.countByPathMethod(
        merged.path,
        merged.method ?? null,
        id,
      )
      if (exists > 0) {
        throw createAppException(AppErrorCode.SNIPPET_EXISTS)
      }
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

    const next = await this.prepareInput(merged)
    const patch: Record<string, unknown> = {
      type: next.type,
      private: next.private,
      raw: next.raw,
      path: next.path,
      comment: next.comment ?? null,
      metatype: next.metatype ?? null,
      schema: next.schema ?? null,
      method: next.method ?? null,
      enable: next.enable,
      builtIn: next.builtIn,
      compiledCode: next.compiledCode ?? null,
    }

    if (mergedSecret !== undefined) {
      patch.secret = mergedSecret ? EncryptUtil.encrypt(mergedSecret) : null
    }

    await this.deleteCachedSnippetByPath(old.path)
    const updated = await this.snippetRepository.update(id, patch)
    if (!updated) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }

    if (this.isThemePath(old.path) || this.isThemePath(updated.path)) {
      await this.notifyAggregateThemeUpdate()
    }

    return this.transformLeanSnippetModel(updated)
  }

  async delete(id: string): Promise<void> {
    const doc = await this.snippetRepository.findById(id)
    if (!doc) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }

    if (doc.type === SnippetType.Function && doc.builtIn) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'built-in function snippet is not allowed to delete',
      })
    }

    await this.snippetRepository.deleteById(id)
    await this.deleteCachedSnippetByPath(doc.path)
    if (this.isThemePath(doc.path)) {
      await this.notifyAggregateThemeUpdate()
    }
  }

  async deleteByPath(path: string, recursive: boolean): Promise<void> {
    const normalizedPath = this.normalizePath(path)
    if (normalizedPath.endsWith('/') && !recursive) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'recursive=true is required to delete a prefix',
      })
    }
    const effectivePath =
      recursive && !normalizedPath.endsWith('/')
        ? `${normalizedPath}/`
        : normalizedPath
    const deleted = await this.snippetRepository.deleteByPath(
      effectivePath,
      recursive,
    )
    await Promise.all(
      deleted.map((row) => this.deleteCachedSnippetByPath(row.path)),
    )
    if (deleted.some((row) => this.isThemePath(row.path))) {
      await this.notifyAggregateThemeUpdate()
    }
  }

  async movePath(from: string, to: string, recursive: boolean) {
    const normalizedFrom = this.normalizePath(from)
    const normalizedTo = this.normalizePath(to)
    const effectiveFrom =
      recursive && !normalizedFrom.endsWith('/')
        ? `${normalizedFrom}/`
        : normalizedFrom
    const effectiveTo =
      recursive && !normalizedTo.endsWith('/')
        ? `${normalizedTo}/`
        : normalizedTo
    const moved = await this.snippetRepository.movePath(
      effectiveFrom,
      effectiveTo,
      recursive,
    )
    await Promise.all(
      moved.map((row) => this.deleteCachedSnippetByPath(row.path)),
    )
    if (
      moved.some(
        (row) => this.isThemePath(row.path) || this.isThemePath(effectiveFrom),
      )
    ) {
      await this.notifyAggregateThemeUpdate()
    }
    return moved.map((row) => this.transformLeanSnippetModel(row))
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

  private async prepareInput(model: SnippetCreateInput) {
    const next = { ...model, path: this.normalizePath(model.path) }
    next.type ??= SnippetType.JSON

    switch (next.type) {
      case SnippetType.JSON: {
        try {
          JSON.parse(next.raw)
        } catch {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_JSON)
        }
        break
      }
      case SnippetType.JSON5: {
        try {
          JSON5.parse(next.raw)
        } catch {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_JSON5)
        }
        break
      }
      case SnippetType.YAML: {
        try {
          load(next.raw)
        } catch {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_YAML)
        }
        break
      }
      case SnippetType.Function: {
        next.method ??= 'GET'
        next.enable ??= true
        const isValid = await this.serverlessService.isValidServerlessFunction(
          next.raw,
        )
        if (typeof isValid === 'string') {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_FUNCTION, {
            extra: isValid,
          })
        }
        if (!isValid) {
          throw createAppException(AppErrorCode.SNIPPET_INVALID_FUNCTION)
        }
        const compiled = await this.serverlessService.compileTypescriptCode(
          next.raw,
        )
        if (compiled) {
          next.compiledCode = compiled
        }
        break
      }
      case SnippetType.Skill: {
        next.path = normalizeSkillPath(next.path)
        if (!next.path.endsWith('/SKILL.md')) {
          throw createAppException(AppErrorCode.INVALID_PARAMETER, {
            message: 'skill snippet path must end with /SKILL.md',
          })
        }
        const fm = this.parseSkillFrontmatter(next.raw)
        if (fm.name !== deriveSkillName(next.path)) {
          throw createAppException(AppErrorCode.SNIPPET_SKILL_NAME_MISMATCH)
        }
        next.comment = fm.description
        break
      }

      default: {
        break
      }
    }

    if (next.type !== SnippetType.Function) {
      delete next.enable
      delete next.method
      delete next.secret
    } else if (next.secret) {
      next.secret = EncryptUtil.encrypt(next.secret)
    }

    return {
      type: next.type,
      private: next.private ?? false,
      raw: next.raw,
      path: next.path,
      comment: next.comment ?? null,
      metatype: next.metatype ?? null,
      schema: next.schema ?? null,
      method: next.method ?? null,
      secret: next.secret ?? null,
      enable: next.enable ?? true,
      builtIn: next.builtIn ?? false,
      compiledCode: next.compiledCode ?? null,
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

  async getSnippetByPath(path: string): Promise<SnippetRow | null> {
    const row = await this.snippetRepository.findByPath(
      this.normalizePath(path),
    )
    if (!row) return null
    if (row.type === SnippetType.Function) return null
    return row
  }

  async getPublicSnippetByPath(path: string) {
    const snippet = await this.getSnippetByPath(path)
    if (!snippet) {
      throw createAppException(AppErrorCode.SNIPPET_NOT_FOUND)
    }

    if (snippet.private && !RequestContext.hasAdminAccess()) {
      throw createAppException(AppErrorCode.SNIPPET_PRIVATE)
    }

    const res = await this.attachSnippet(snippet)
    await this.cacheSnippet(res, res.data)
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
      case SnippetType.Text:
      case SnippetType.Skill: {
        Reflect.set(model, 'data', model.raw)
        break
      }
    }

    return model as T & { data: any }
  }

  async findSkillBundlesByIds(
    ids: string[],
    options: { includePrivate?: boolean } = {},
  ): Promise<SkillBundleView[]> {
    if (ids.length === 0) return []
    const includePrivate = options.includePrivate ?? false
    const skillRows = await this.snippetRepository.findSkillsByIds(
      ids,
      includePrivate,
    )
    if (skillRows.length === 0) return []

    const dirs = skillRows.map((row) => stripSkillSuffix(row.path))
    const assetRows = await this.snippetRepository.findAssetsByDirs(dirs, {
      includePrivate,
    })

    const urlConfig = await this.configsService.get('url')
    const serverUrl = urlConfig?.serverUrl ?? ''

    const assetsByDir = new Map<string, SnippetRow[]>()
    for (const dir of dirs) assetsByDir.set(dir, [])
    for (const asset of assetRows) {
      for (const dir of dirs) {
        if (asset.path.startsWith(`${dir}/`)) {
          assetsByDir.get(dir)!.push(asset)
          break
        }
      }
    }

    const rowMap = new Map(skillRows.map((r) => [String(r.id), r]))
    return ids
      .map((id) => rowMap.get(id))
      .filter((r): r is SnippetRow => r !== undefined)
      .map((row) =>
        toSkillBundleView(
          row,
          assetsByDir.get(stripSkillSuffix(row.path)) ?? [],
          serverUrl,
        ),
      )
  }

  async importSnippets(inputs: SnippetCreateInput[]): Promise<{
    created: number
    updated: number
    snippets: SnippetRow[]
  }> {
    if (inputs.length === 0) {
      return { created: 0, updated: 0, snippets: [] }
    }
    const prepared = await Promise.all(
      inputs.map((input) => this.prepareInput(input)),
    )
    const result = await this.snippetRepository.upsertManyByPath(prepared)
    await Promise.all(
      result.snippets.map((row) => this.deleteCachedSnippetByPath(row.path)),
    )
    if (result.snippets.some((row) => this.isThemePath(row.path))) {
      await this.notifyAggregateThemeUpdate()
    }
    return {
      created: result.created,
      updated: result.updated,
      snippets: result.snippets.map((row) =>
        this.transformLeanSnippetModel(row),
      ),
    }
  }

  private snippetCacheKey(path: string, isPrivate: boolean) {
    return `path:${path}:${isPrivate ? 'private' : ''}`
  }

  private async cacheRedisValue(key: string, value: any) {
    const client = this.redisService.getClient()
    await client.hset(
      getRedisKey(RedisKeys.SnippetCache),
      key,
      typeof value !== 'string' ? JSON.stringify(value) : value,
    )
  }

  private async deleteCachedKeyVariants(path: string) {
    const client = this.redisService.getClient()
    const cacheKey = getRedisKey(RedisKeys.SnippetCache)
    await Promise.all(
      [`path:${path}:`, `path:${path}:private`].map((key) =>
        client.hdel(cacheKey, key),
      ),
    )
  }

  async cacheSnippet(model: SnippetRow, value: any) {
    await this.cacheRedisValue(
      this.snippetCacheKey(model.path, !!model.private),
      value,
    )
  }

  async getCachedSnippetByPath(path: string, accessType: 'public' | 'private') {
    const key = this.snippetCacheKey(
      this.normalizePath(path),
      accessType === 'private',
    )
    const client = this.redisService.getClient()
    return client.hget(getRedisKey(RedisKeys.SnippetCache), key)
  }

  async deleteCachedSnippetByPath(path: string) {
    await this.deleteCachedKeyVariants(this.normalizePath(path))
  }

  async getFunctionSnippetByPath(
    path: string,
    method: string,
  ): Promise<SnippetRow | null> {
    return this.snippetRepository.findFunctionByPath(
      this.normalizePath(path),
      method,
    )
  }

  async getFunctionSnippetByPathPrefix(
    candidatePaths: string[],
    method: string,
  ): Promise<SnippetRow | null> {
    return this.snippetRepository.findFunctionByPathPrefix(
      candidatePaths.map((path) => this.normalizePath(path)),
      method,
    )
  }
}
