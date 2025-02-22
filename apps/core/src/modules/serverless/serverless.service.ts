import fs, { mkdir, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path, { resolve } from 'node:path'
import { isURL } from 'class-validator'
import { isPlainObject } from 'lodash'
import { LRUCache } from 'lru-cache'
import { mongo } from 'mongoose'
import qs from 'qs'
import type { OnModuleInit } from '@nestjs/common'
import type {
  BuiltInFunctionObject,
  FunctionContextRequest,
  FunctionContextResponse,
} from './function.types'

import { parseAsync, transformAsync } from '@babel/core'
import * as t from '@babel/types'
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
import { isTest } from '~/global/env.global'
import { DatabaseService } from '~/processors/database/database.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { CacheService } from '~/processors/redis/cache.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { EncryptUtil } from '~/utils/encrypt.util'
import { getRedisKey } from '~/utils/redis.util'
import { safeEval } from '~/utils/safe-eval.util'
import { scheduleManager } from '~/utils/schedule.util'
import { safeProcessEnv } from '~/utils/system.util'
import { safePathJoin } from '~/utils/tool.util'

import { ConfigsService } from '../configs/configs.service'
import { SnippetModel, SnippetType } from '../snippet/snippet.model'
import { allBuiltInSnippetPack as builtInSnippets } from './pack'
import { ServerlessStorageCollectionName } from './serverless.model'
import { complieTypeScriptBabelOptions, hashStable } from './serverless.util'

type ScopeContext = {
  req: FunctionContextRequest
  res: FunctionContextResponse
  isAuthenticated: boolean
}
class CleanableScope {
  public scopeContextLRU = new LRUCache<string, any>({
    max: 100,
    ttl: 1000 * 60 * 5,
  })
}
@Injectable()
export class ServerlessService implements OnModuleInit {
  private readonly logger: Logger
  private readonly cleanableScope: CleanableScope
  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: MongooseModel<SnippetModel>,
    private readonly assetService: AssetService,
    private readonly httpService: HttpService,
    private readonly databaseService: DatabaseService,

    private readonly redisService: RedisService,
    private readonly configService: ConfigsService,

    private readonly eventService: EventManagerService,
  ) {
    this.logger = new Logger(ServerlessService.name)
    this.cleanableScope = new CleanableScope()
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

  private async getService(serviceName: 'http' | 'config') {
    switch (serviceName) {
      case 'http': {
        return {
          axios: this.httpService.axiosRef,
          requestWithCache: this.httpService.getAndCacheRequest.bind(
            this.httpService,
          ),
        }
      }
      case 'config': {
        return {
          get: (key: string) => this.configService.get(key as any),
        }
      }
    }

    throw new BizException(
      ErrorCodeEnum.ServerlessError,
      `${serviceName} service not provide`,
    )
  }

  async injectContextIntoServerlessFunctionAndCall(
    model: SnippetModel,
    context: ScopeContext,
  ) {
    const { raw: functionString } = model
    const scope = `${model.reference}/${model.name}`

    const logger = new Logger(`fx:${scope}`)
    const globalContext = await this.createScopeContext(
      scope,
      context,
      model,
      logger,
    )

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

    return await safeEval(
      `async function func() {
        ${compliedCode};
      return handler(context, require)
      }
      return func()
      `,
      {
        ...globalContext,
        global: globalContext,
        globalThis: globalContext,
        exports: {},
        module: {
          exports: {},
        },
      },
    ).catch((error) => {
      logger.error(error)
      return Promise.reject(
        new BizException(
          ErrorCodeEnum.ServerlessError,
          error.message || 'Unknown error, please check log',
        ),
      )
    })
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

  private createNewContextRequire() {
    const __require = isTest
      ? createRequire(resolve(process.cwd(), './node_modules'))
      : createRequire(NODE_REQUIRE_PATH)

    async function $require(
      this: ServerlessService,
      id: string,
      useCache = true,
    ) {
      if (!id || typeof id !== 'string') {
        throw new Error('require id is not valid')
      }

      // 1. if is remote module
      if (isURL(id, { protocols: ['http', 'https'], require_protocol: true })) {
        let text: string

        try {
          text = useCache
            ? await this.httpService.getAndCacheRequest(id)
            : await this.httpService.axiosRef.get(id).then((res) => res.data)
        } catch {
          throw new InternalServerErrorException(
            'Failed to fetch remote module',
          )
        }
        return await safeEval(
          `${text}; return module.exports ? module.exports : exports.default ? exports.default : exports`,
          {
            exports: {},
            module: {
              exports: null,
            },
          },
        )
      }

      const bannedLibs = [
        'child_process',
        'cluster',
        'fs',
        'fs/promises',
        'os',
        'process',
        'sys',
        'v8',
        'vm',
      ]

      for (const lib of [...bannedLibs]) {
        bannedLibs.push(`node:${lib}`)
      }

      if (bannedLibs.includes(id)) {
        throw new Error(`cannot require ${id}`)
      }

      return __require(id)
    }

    return $require.bind(this) as NodeRequire
  }

  private async createScopeContext(
    scope: string,
    context: ScopeContext,
    model: SnippetModel,
    logger: Logger,
  ) {
    const secretObj = model.secret
      ? qs.parse(EncryptUtil.decrypt(model.secret))
      : {}

    if (!isPlainObject(secretObj)) {
      throw new InternalServerErrorException(
        `secret parsing error, must be object, got ${typeof secretObj}`,
      )
    }

    const requestContext = {
      ...context,
      ...context.res,
      query: context.req.query,
      headers: context.req.headers,
      // TODO wildcard params
      params: context.req.params || {},
      method: context.req.method,

      secret: secretObj,

      model,
      document: model,
      name: model.name,
      reference: model.reference,
    }

    const require = this.createNewContextRequire()
    if (this.cleanableScope.scopeContextLRU.has(scope)) {
      const context = this.cleanableScope.scopeContextLRU.get(scope)

      return Object.assign({}, context, {
        context: { ...context.context, ...requestContext, require },
      })
    }

    const createdContext = {
      context: {
        ...requestContext,

        storage: {
          cache: this.mockStorageCache,
          db: this.mockDb(
            `${model.reference || '#########debug######'}@${model.name}`,
          ),
          dangerousAccessDbInstance: () => {
            return [this.databaseService.db, mongo]
          },
        },

        getMaster: this.mockGetMaster.bind(this),
        getService: this.getService.bind(this),

        broadcast: (type: string, data: any) =>
          // @ts-ignore
          this.eventService.broadcast(`fn#${type}`, data, {
            scope: EventScope.TO_VISITOR_ADMIN,
          }),

        writeAsset: async (
          path: string,
          data: any,
          options: Parameters<typeof fs.writeFile>[2],
        ) => {
          return await this.assetService.writeUserCustomAsset(
            safePathJoin(path),
            data,
            options,
          )
        },
        readAsset: async (
          path: string,
          options: Parameters<typeof fs.readFile>[1],
        ) => {
          return await this.assetService.getAsset(safePathJoin(path), options)
        },
      },

      // inject global
      __dirname: DATA_DIR,
      __filename: '',

      // inject some zx utils
      fetch,

      // inject Global API
      Buffer,

      // inject logger
      console: logger,
      logger,

      require,
      import(module: string) {
        return Promise.resolve(require(module))
      },

      process: {
        env: safeProcessEnv(),
        nextTick: scheduleManager.schedule.bind(null),
      },
    }

    this.cleanableScope.scopeContextLRU.set(scope, createdContext)

    return createdContext
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
