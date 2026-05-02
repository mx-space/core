import fs, { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

import { parseAsync, transformAsync } from '@babel/core'
import * as t from '@babel/types'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { isPlainObject } from 'es-toolkit/compat'
import qs from 'qs'

import { BizException } from '~/common/exceptions/biz.exception'
import {
  EventScope,
  SERVERLESS_EVENT_PREFIX,
} from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import {
  OWNER_PROFILE_COLLECTION_NAME,
  READER_COLLECTION_NAME,
} from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DATA_DIR, NODE_REQUIRE_PATH } from '~/constants/path.constant'
import { isDev } from '~/global/env.global'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { EncryptUtil } from '~/utils/encrypt.util'
import { getRedisKey } from '~/utils/redis.util'
import type { SandboxResult } from '~/utils/sandbox'
import { SandboxService } from '~/utils/sandbox'
import { safePathJoin } from '~/utils/tool.util'

import { ConfigsService } from '../configs/configs.service'
import { SnippetType } from '../snippet/snippet.model'
import type { SnippetRow } from '../snippet/snippet.repository'
import { SnippetRepository } from '../snippet/snippet.repository'
import type {
  BuiltInFunctionObject,
  FunctionContextRequest,
  FunctionContextResponse,
} from './function.types'
import { allBuiltInSnippetPack as builtInSnippets } from './pack'
import {
  ServerlessLogRepository,
  ServerlessStorageRepository,
} from './serverless.repository'
import { complieTypeScriptBabelOptions } from './serverless.util'

type ScopeContext = {
  req: FunctionContextRequest
  res: FunctionContextResponse
  hasAdminAccess: boolean
}

@Injectable()
export class ServerlessService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger
  private readonly sandboxService: SandboxService

  constructor(
    private readonly snippetRepository: SnippetRepository,
    private readonly storageRepository: ServerlessStorageRepository,
    private readonly logRepository: ServerlessLogRepository,
    private readonly assetService: AssetService,

    private readonly redisService: RedisService,
    private readonly configService: ConfigsService,

    private readonly eventService: EventManagerService,
  ) {
    this.logger = new Logger(ServerlessService.name)
    this.sandboxService = this.createSandboxService()
  }

  async onModuleDestroy() {
    await this.sandboxService.shutdown()
  }

  private createSandboxService(): SandboxService {
    return new SandboxService({
      maxWorkers: 4,
      defaultTimeout: 30000,
      requireBasePath: NODE_REQUIRE_PATH,
      bridgeHandlers: {
        'storage.cache.get': (key: string) => this.mockStorageCache.get(key),
        'storage.cache.set': (key: string, value: unknown, ttl?: number) =>
          this.mockStorageCache.set(
            key,
            value as object | string,
            ttl?.toString(),
          ),
        'storage.cache.del': (key: string) =>
          this.mockStorageCache.del(key).then(() => {}),
        'storage.db.get': (namespace: string, key: string) =>
          this.mockDb(namespace).get(key),
        'storage.db.find': (namespace: string, condition: unknown) =>
          this.mockDb(namespace).find(condition as KV),
        'storage.db.set': (namespace: string, key: string, value: unknown) =>
          this.mockDb(namespace).set(key, value),
        'storage.db.insert': (namespace: string, key: string, value: unknown) =>
          this.mockDb(namespace).insert(key, value),
        'storage.db.update': (namespace: string, key: string, value: unknown) =>
          this.mockDb(namespace).update(key, value),
        'storage.db.del': (namespace: string, key: string) =>
          this.mockDb(namespace).del(key),
        getOwner: () => this.mockGetOwner(),
        'config.get': (key: string) => this.configService.get(key as any),
        broadcast: (type: string, data: unknown) => {
          this.eventService.broadcast(
            `${SERVERLESS_EVENT_PREFIX}${type}`,
            data,
            {
              scope: EventScope.TO_VISITOR_ADMIN,
            },
          )
        },
        writeAsset: async (path: string, data: unknown, options?: unknown) => {
          await this.assetService.writeUserCustomAsset(
            safePathJoin(path),
            data as Parameters<typeof fs.writeFile>[1],
            options as Parameters<typeof fs.writeFile>[2],
          )
        },
        readAsset: (path: string, options?: unknown) =>
          this.assetService.getAsset(
            safePathJoin(path),
            options as Parameters<typeof fs.readFile>[1],
          ),
      },
    })
  }

  async onModuleInit() {
    mkdir(NODE_REQUIRE_PATH, { recursive: true }).then(async () => {
      const pkgPath = path.join(DATA_DIR, 'package.json')

      const isPackageFileExist = await stat(pkgPath)
        .then(() => true)
        .catch(() => false)

      if (!isPackageFileExist) {
        await fs.writeFile(
          pkgPath,
          JSON.stringify({ name: 'modules' }, null, 2),
        )
      }
    })

    await this.pourBuiltInFunctions()
  }

  public get repository() {
    return this.snippetRepository
  }

  private mockStorageCache = Object.freeze({
    get: async (key: string) => {
      const client = this.redisService.getClient()
      return client
        .get(getRedisKey(RedisKeys.ServerlessStorage, key))
        .then((string) => {
          if (!string) return null
          return JSON.safeParse(string)
        })
    },
    set: async (key: string, value: object | string, ttl?: string) => {
      const client = this.redisService.getClient()
      const cacheKey = getRedisKey(RedisKeys.ServerlessStorage, key)
      await client.set(cacheKey, JSON.stringify(value))
      await client.expire(cacheKey, ttl || 60 * 60 * 24 * 7)
    },
    del: async (key: string) => {
      const client = this.redisService.getClient()
      return client.hdel(getRedisKey(RedisKeys.ServerlessStorage), key)
    },
  })
  private async mockGetOwner() {
    // TODO(wave 4): restore owner lookup through the reader/owner PG
    // repositories after those modules leave Mongoose.
    this.logger.warn(
      `getOwner serverless shim is unavailable until ${READER_COLLECTION_NAME}/${OWNER_PROFILE_COLLECTION_NAME} cutover`,
    )
    return null
  }

  private mockDb(namespace: string) {
    const checkRecordIsExist = async (key: string) => {
      return (await this.storageRepository.get(namespace, key)) !== null
    }

    const updateKey = async (key: string, value: any) => {
      if (!(await checkRecordIsExist(key))) {
        throw new InternalServerErrorException('key not exist')
      }

      return this.storageRepository.upsert(namespace, key, value)
    }

    return {
      async get(key: string) {
        return this.storageRepository.get(namespace, key)
      },
      async find(condition: KV) {
        if (typeof condition !== 'object') {
          throw new InternalServerErrorException('condition must be object')
        }

        const entries = await this.storageRepository.listNamespace(namespace)
        return entries
          .filter((entry) =>
            Object.entries(condition).every(
              ([key, value]) => (entry.value as any)?.[key] === value,
            ),
          )
          .map((entry) => ({
            _id: entry.id,
            id: entry.id,
            key: entry.key,
            value: entry.value,
          }))
      },
      async set(key: string, value: any) {
        if (typeof key !== 'string') {
          throw new InternalServerErrorException('key must be string')
        }

        if (await checkRecordIsExist(key)) {
          return updateKey(key, value)
        }

        return this.storageRepository.upsert(namespace, key, value)
      },
      async insert(key: string, value: any) {
        if (await checkRecordIsExist(key)) {
          throw new InternalServerErrorException('key already exists')
        }

        return this.storageRepository.upsert(namespace, key, value)
      },
      update: updateKey,
      del(key: string) {
        return this.storageRepository.delete(namespace, key)
      },
    } as const
  }

  async injectContextIntoServerlessFunctionAndCall(
    model: SnippetRow,
    context: ScopeContext,
  ): Promise<any> {
    const { raw: functionString } = model
    const scope = `${model.reference}/${model.name}`

    let compiledCode = model.compiledCode ?? undefined
    if (!compiledCode) {
      compiledCode =
        (await this.compileTypescriptCode(functionString)) ?? undefined
      if (compiledCode && model.id) {
        this.snippetRepository
          .update(model.id, { compiledCode })
          .catch((error) => {
            this.logger.error(
              `Backfill compiledCode failed for ${scope}: ${error.message}`,
            )
          })
      }
    }

    if (!compiledCode) {
      throw new InternalServerErrorException(
        'Compile serverless function code failed',
      )
    }

    const secretObj = model.secret
      ? qs.parse(EncryptUtil.decrypt(model.secret))
      : {}

    if (!isPlainObject(secretObj)) {
      throw new InternalServerErrorException(
        `secret parsing error, must be object, got ${typeof secretObj}`,
      )
    }

    const serializableReq = {
      query: context.req.query,
      headers: Object.fromEntries(
        Object.entries(context.req.headers || {}).filter(
          ([, v]) => typeof v !== 'function',
        ),
      ),
      params: context.req.params,
      method: context.req.method,
      url: context.req.url,
      ip: context.req.ip,
      body: context.req.body,
    }

    const sandboxContext = {
      req: serializableReq,
      res: {},
      hasAdminAccess: context.hasAdminAccess,
      isAuthenticated: context.hasAdminAccess,
      secret: secretObj as Record<string, unknown>,
      model: {
        id: model.id ?? '',
        name: model.name,
        reference: model.reference,
      },
    }

    const result = await this.sandboxService.execute(
      compiledCode,
      sandboxContext,
      {
        timeout: 30000,
        namespace: scope,
      },
    )

    this.saveInvocationLog(model, context, result).catch((error) => {
      this.logger.error(`Save invocation log failed: ${error.message}`)
    })

    if (!result.success) {
      this.logger.error(
        `Serverless function error [${scope}]: ${result.error?.message}`,
        result.error?.stack,
      )
      throw new BizException(
        ErrorCodeEnum.ServerlessError,
        result.error?.message || 'Unknown error, please check log',
      )
    }

    return result.data
  }

  async compileTypescriptCode(
    code: string,
  ): Promise<string | null | undefined> {
    const res = await transformAsync(code, complieTypeScriptBabelOptions)
    if (!res) {
      throw new InternalServerErrorException('convert code error')
    }

    return res.code
  }

  private async saveInvocationLog(
    model: SnippetRow,
    context: ScopeContext,
    result: SandboxResult,
  ) {
    await this.logRepository.record({
      functionId: model.id || null,
      reference: model.reference,
      name: model.name,
      method: context.req.method,
      ip: context.req.ip,
      status: result.success ? 'success' : 'error',
      executionTime: result.executionTime,
      logs: result.logs || [],
      error: result.error,
    })
  }

  async getInvocationLogs(
    functionId: string,
    options: { page: number; size: number; status?: 'success' | 'error' },
  ) {
    const { page, size, status } = options
    const result = await this.logRepository.list({
      page,
      size,
      functionId,
      status,
    } as Parameters<ServerlessLogRepository['list']>[0])
    const totalPage = result.pagination.totalPage
    return {
      data: result.data.map(({ logs: _logs, ...row }) => row),
      pagination: {
        total: result.pagination.total,
        size,
        currentPage: page,
        totalPage,
        hasNextPage: result.pagination.hasNextPage,
        hasPrevPage: result.pagination.hasPrevPage,
      },
    }
  }

  async getInvocationLogDetail(id: string) {
    return this.logRepository.findLogById(id)
  }

  async isValidServerlessFunction(raw: string) {
    try {
      const ast = (await parseAsync(
        raw,
        complieTypeScriptBabelOptions,
      )) as t.File

      const { body } = ast.program as t.Program

      const hasEntryFunction = body.some(
        (node: t.Declaration) =>
          (node.type == 'ExportDefaultDeclaration' &&
            isHandlerFunction(node.declaration)) ||
          isHandlerFunction(node),
      )

      return hasEntryFunction
    } catch (error) {
      if (isDev) {
        console.error(error.message)
      }
      return error.message?.split('\n').at(0)
    }
  }

  private async pourBuiltInFunctions() {
    const paths = [] as string[]
    const references = new Set<string>()
    const pathCodeMap = new Map<string, BuiltInFunctionObject>()
    for (const s of builtInSnippets) {
      paths.push(s.path)
      pathCodeMap.set(s.path, s)
      if (s.reference) {
        references.add(s.reference)
      }
    }

    const result = await this.snippetRepository.findFunctionsByNamesReferences(
      paths,
      ['built-in', ...Array.from(references.values())],
    )

    const migrationTasks = [] as Promise<any>[]
    for (const doc of result) {
      pathCodeMap.delete(doc.name)

      if (!doc.builtIn) {
        migrationTasks.push(
          this.snippetRepository.update(doc.id, { builtIn: true }),
        )
      }
    }
    await Promise.all(migrationTasks)

    for (const [path, { code, method, name, reference }] of pathCodeMap) {
      this.logger.log(`pour built-in function: ${name}`)
      const compiledCode = await this.compileTypescriptCode(code)
      await this.snippetRepository.create({
        type: SnippetType.Function,
        name: path,
        reference: reference || 'built-in',
        raw: code,
        compiledCode: compiledCode ?? null,
        method: method || 'get',
        enable: true,
        private: false,
        builtIn: true,
      })
    }
  }

  async isBuiltInFunction(id: string) {
    const document = await this.snippetRepository.findById(id)
    if (!document) return false
    const isBuiltin = document.type == SnippetType.Function && document.builtIn
    return isBuiltin
      ? {
          name: document.name,
          reference: document.reference || 'built-in',
        }
      : false
  }

  async resetBuiltInFunction(model: { name: string; reference: string }) {
    const { name, reference } = model
    const builtInSnippet = builtInSnippets.find(
      (s) => s.path === name && s.reference === reference,
    )
    if (!builtInSnippet) {
      throw new InternalServerErrorException('built-in function not found')
    }

    const compiledCode = await this.compileTypescriptCode(builtInSnippet.code)
    await this.snippetRepository.updateByName(name, {
      raw: builtInSnippet.code,
      compiledCode: compiledCode ?? null,
    })
  }
}

function isHandlerFunction(
  node:
    | t.Declaration
    | t.FunctionDeclaration
    | t.ClassDeclaration
    | t.TSDeclareFunction
    | t.Expression,
): boolean {
  // @ts-expect-error
  return t.isFunction(node) && node?.id?.name === 'handler'
}
