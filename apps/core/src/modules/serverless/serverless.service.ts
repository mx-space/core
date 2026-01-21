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
import { BizException } from '~/common/exceptions/biz.exception'
import { EventScope } from '~/constants/business-event.constant'
import {
  RedisKeys,
  SERVERLESS_COMPLIE_CACHE_TTL,
} from '~/constants/cache.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DATA_DIR, NODE_REQUIRE_PATH } from '~/constants/path.constant'
import { isDev } from '~/global/env.global'
import { DatabaseService } from '~/processors/database/database.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { EncryptUtil } from '~/utils/encrypt.util'
import { getRedisKey } from '~/utils/redis.util'
import { SandboxService } from '~/utils/sandbox'
import { safePathJoin } from '~/utils/tool.util'
import { isPlainObject } from 'es-toolkit/compat'
import qs from 'qs'
import { ConfigsService } from '../configs/configs.service'
import { SnippetModel, SnippetType } from '../snippet/snippet.model'
import type {
  BuiltInFunctionObject,
  FunctionContextRequest,
  FunctionContextResponse,
} from './function.types'
import { allBuiltInSnippetPack as builtInSnippets } from './pack'
import { ServerlessStorageCollectionName } from './serverless.model'
import { complieTypeScriptBabelOptions, hashStable } from './serverless.util'

type ScopeContext = {
  req: FunctionContextRequest
  res: FunctionContextResponse
  isAuthenticated: boolean
}

@Injectable()
export class ServerlessService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger
  private readonly sandboxService: SandboxService

  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: MongooseModel<SnippetModel>,
    private readonly assetService: AssetService,
    private readonly databaseService: DatabaseService,

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
        getMaster: () => this.mockGetMaster(),
        'config.get': (key: string) => this.configService.get(key as any),
        broadcast: (type: string, data: unknown) => {
          // @ts-ignore
          this.eventService.broadcast(`fn#${type}`, data, {
            scope: EventScope.TO_VISITOR_ADMIN,
          })
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

  public get model() {
    return this.snippetModel
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
  private async mockGetMaster() {
    const collection = this.databaseService.db.collection('users')
    const cur = collection.aggregate([
      {
        $project: {
          id: 1,
          _id: 1,
          username: 1,
          name: 1,
          introduce: 1,
          avatar: 1,
          mail: 1,
          url: 1,
          lastLoginTime: 1,
          lastLoginIp: 1,
          socialIds: 1,
        },
      },
    ])

    return await cur.next().then((doc) => {
      cur.close()
      return doc
    })
  }

  private mockDb(namespace: string) {
    const db = this.databaseService.db
    const collection = db.collection(ServerlessStorageCollectionName)

    const checkRecordIsExist = async (key: string) => {
      const has = await collection
        .countDocuments({
          namespace,
          key,
        })
        .then((count) => count > 0)

      return has
    }

    const updateKey = async (key: string, value: any) => {
      if (!(await checkRecordIsExist(key))) {
        throw new InternalServerErrorException('key not exist')
      }

      return collection.updateOne(
        {
          namespace,
          key,
        },
        {
          $set: {
            value,
          },
        },
      )
    }

    return {
      async get(key: string) {
        return collection
          .findOne({
            namespace,
            key,
          })
          .then((doc) => {
            return doc?.value ?? null
          })
      },
      async find(condition: KV) {
        if (typeof condition !== 'object') {
          throw new InternalServerErrorException('condition must be object')
        }

        condition.namespace = namespace

        return collection
          .aggregate([
            { $match: condition },
            {
              $project: {
                value: 1,
                key: 1,
                _id: 1,
              },
            },
          ])
          .toArray()
      },
      async set(key: string, value: any) {
        if (typeof key !== 'string') {
          throw new InternalServerErrorException('key must be string')
        }

        if (await checkRecordIsExist(key)) {
          return updateKey(key, value)
        }

        return collection.insertOne({
          namespace,
          key,
          value,
        })
      },
      async insert(key: string, value: any) {
        const has = await collection
          .countDocuments({
            namespace,
            key,
          })
          .then((count) => count > 0)

        if (has) {
          throw new InternalServerErrorException('key already exists')
        }

        return collection.insertOne({
          namespace,
          key,
          value,
        })
      },
      update: updateKey,
      del(key: string) {
        return collection.deleteOne({
          namespace,
          key,
        })
      },
    } as const
  }

  async injectContextIntoServerlessFunctionAndCall(
    model: SnippetModel,
    context: ScopeContext,
  ): Promise<any> {
    const { raw: functionString } = model
    const scope = `${model.reference}/${model.name}`

    const cacheKey = model.updated
      ? getRedisKey(
          RedisKeys.FunctionComplieCache,
          hashStable(`${model.id}_${model.updated}`),
        )
      : ''

    const redis = this.redisService.getClient()
    let cached: string | null = null
    if (cacheKey) {
      cached = await redis.get(cacheKey)
    }

    const compliedCode =
      cached ?? (await this.complieTypescriptCode(functionString))

    if (!compliedCode) {
      throw new InternalServerErrorException(
        'Complie serverless function code failed',
      )
    }
    if (!cached && cacheKey) {
      await redis.set(cacheKey, compliedCode)
    }
    await redis.expire(cacheKey, SERVERLESS_COMPLIE_CACHE_TTL)

    const secretObj = model.secret
      ? qs.parse(EncryptUtil.decrypt(model.secret))
      : {}

    if (!isPlainObject(secretObj)) {
      throw new InternalServerErrorException(
        `secret parsing error, must be object, got ${typeof secretObj}`,
      )
    }

    // 只提取可序列化的数据，过滤掉函数
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
      res: {}, // res 的方法会在 worker 内部通过 bridge 重建
      isAuthenticated: context.isAuthenticated,
      secret: secretObj as Record<string, unknown>,
      model: {
        id: model.id,
        name: model.name,
        reference: model.reference,
      },
    }

    const result = await this.sandboxService.execute(
      compliedCode,
      sandboxContext,
      {
        timeout: 30000,
        namespace: scope,
      },
    )

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

  private async complieTypescriptCode(
    code: string,
  ): Promise<string | null | undefined> {
    const res = await transformAsync(code, complieTypeScriptBabelOptions)
    if (!res) {
      throw new InternalServerErrorException('convert code error')
    }

    return res.code
  }

  async isValidServerlessFunction(raw: string) {
    try {
      // 验证 handler 是否存在并且是函数
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

    // 0. get built-in functions is exist in db
    const result = await this.model.find({
      name: {
        $in: paths,
      },
      // FIXME reference not only `built-in` now
      reference: {
        $in: ['built-in'].concat(Array.from(references.values())),
      },
      type: SnippetType.Function,
    })

    // 1. filter is exist
    const migrationTasks = [] as Promise<any>[]
    for (const doc of result) {
      const path = doc.name
      pathCodeMap.delete(path)

      // migration, add builtIn set to `true`
      if (!doc.builtIn) {
        migrationTasks.push(doc.updateOne({ builtIn: true }))
      }
    }
    await Promise.all(migrationTasks)

    // 2. pour

    for (const [path, { code, method, name, reference }] of pathCodeMap) {
      this.logger.log(`pour built-in function: ${name}`)
      await this.model.create({
        type: SnippetType.Function,
        name: path,
        reference: reference || 'built-in',
        raw: code,
        method: method || 'get',
        enable: true,
        private: false,
        builtIn: true,
      })
    }
  }

  async isBuiltInFunction(id: string) {
    const document = await this.model.findById(id).lean()
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

    await this.model.updateOne(
      {
        name,
      },
      { raw: builtInSnippet.code },
    )
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
