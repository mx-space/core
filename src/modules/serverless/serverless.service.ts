import { isURL } from 'class-validator'
import fs, { mkdir, stat } from 'fs/promises'
import { isPlainObject } from 'lodash'
import LRUCache from 'lru-cache'
import { createRequire } from 'module'
import { mongo } from 'mongoose'
import path, { resolve } from 'path'
import { nextTick } from 'process'
import qs from 'qs'

import { TransformOptions, parseAsync, transformAsync } from '@babel/core'
import BabelPluginTransformCommonJS from '@babel/plugin-transform-modules-commonjs'
import BabelPluginTransformTS from '@babel/plugin-transform-typescript'
import * as t from '@babel/types'
import { VariableDeclaration } from '@babel/types'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { Interval } from '@nestjs/schedule'

import { BizException } from '~/common/exceptions/biz.exception'
import { RedisKeys } from '~/constants/cache.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DATA_DIR, NODE_REQUIRE_PATH } from '~/constants/path.constant'
import { isTest } from '~/global/env.global'
import { DatabaseService } from '~/processors/database/database.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { CacheService } from '~/processors/redis/cache.service'
import { InjectModel } from '~/transformers/model.transformer'
import { UniqueArray } from '~/types/unique'
import { deepCloneWithFunction, getRedisKey, safePathJoin } from '~/utils'
import { safeEval } from '~/utils/safe-eval.util'
import { isBuiltinModule } from '~/utils/system.util'

import PKG from '../../../package.json'
import { SnippetModel } from '../snippet/snippet.model'
import {
  FunctionContextRequest,
  FunctionContextResponse,
} from './function.types'
import { ServerlessStorageCollectionName } from './serverless.model'

@Injectable()
export class ServerlessService {
  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: MongooseModel<SnippetModel>,
    private readonly assetService: AssetService,
    private readonly httpService: HttpService,
    private readonly databaseService: DatabaseService,

    private readonly cacheService: CacheService,
  ) {
    nextTick(() => {
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
    })
  }

  public get model() {
    return this.snippetModel
  }

  private mockStorageCache() {
    return {
      get: async (key: string) => {
        const client = this.cacheService.getClient()
        return await client.hget(getRedisKey(RedisKeys.ServerlessStorage), key)
      },
      set: async (key: string, value: object | string) => {
        const client = this.cacheService.getClient()
        return await client.hset(
          getRedisKey(RedisKeys.ServerlessStorage),
          key,
          typeof value === 'string' ? value : JSON.stringify(value),
        )
      },
      del: async (key: string) => {
        const client = this.cacheService.getClient()
        return await client.hdel(getRedisKey(RedisKeys.ServerlessStorage), key)
      },
    } as const
  }

  async mockGetMaster() {
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

  mockDb(namespace: string) {
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
    context: { req: FunctionContextRequest; res: FunctionContextResponse },
  ) {
    const { raw: functionString } = model
    const logger = new Logger(`fx:${model.reference}/${model.name}`)
    const document = await this.model.findById(model.id)
    const secretObj = model.secret ? qs.parse(model.secret) : {}

    if (!isPlainObject(secretObj)) {
      throw new InternalServerErrorException(
        `secret parsing error, must be object, got ${typeof secretObj}`,
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    const globalContext = {
      context: {
        // inject app req, res
        ...context,
        ...context.res,
        query: context.req.query,
        headers: context.req.headers,
        // TODO wildcard params
        params: Object.assign({}, context.req.params),

        storage: {
          cache: this.mockStorageCache(),
          db: this.mockDb(
            `${model.reference || '#########debug######'}@${model.name}`,
          ),
          dangerousAccessDbInstance: () => {
            return [this.databaseService.db, mongo]
          },
        },

        secret: secretObj,

        model,
        document,
        name: model.name,
        reference: model.reference,
        getMaster: this.mockGetMaster.bind(this),

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

      require: this.inNewContextRequire(),
      get import() {
        return self.require
      },

      process: {
        env: Object.freeze({ ...process.env }),
        nextTick: process.nextTick,
      },
    }

    return await safeEval(
      `async function func() {
        ${await this.convertTypescriptCode(functionString)};
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
    ).catch((err) => {
      logger.error(err)
      return Promise.reject(
        new BizException(
          ErrorCodeEnum.ServerlessError,
          err.message || 'Unknown error, please check log',
        ),
      )
    })
  }

  private getBabelOptions(): TransformOptions {
    return {
      comments: false,
      plugins: [
        BabelPluginTransformTS,
        [
          BabelPluginTransformCommonJS,
          { allowTopLevelThis: false, importInterop: 'node' },
        ],
        function transformImport() {
          return {
            visitor: {
              VariableDeclaration(path: babel.NodePath) {
                const node = path.node as VariableDeclaration
                if (
                  node.kind === 'var' &&
                  node.declarations[0].init?.type === 'CallExpression' &&
                  (
                    (node.declarations[0].init as t.CallExpression)
                      .callee as t.Identifier
                  )?.name === 'require'
                ) {
                  const callee = node.declarations[0].init

                  const _await: t.AwaitExpression = {
                    argument: node.declarations[0].init,
                    type: 'AwaitExpression',
                    start: callee.start,
                    end: callee.end,
                    innerComments: [],
                    loc: callee.loc,
                    leadingComments: [],
                    trailingComments: [],
                  }
                  node.declarations[0].init = _await
                }
              },
            },
          }
        },
      ],
    }
  }
  private lruCache = new LRUCache({
    max: 100,
    ttl: 10 * 1000,
    maxSize: 50000,
    sizeCalculation: (value: string, key: string) => {
      return value.length + key.length
    },
  })
  private async convertTypescriptCode(
    code: string,
  ): Promise<string | null | undefined> {
    if (this.lruCache.has(code)) {
      return this.lruCache.get(code)
    }

    const res = await transformAsync(code, this.getBabelOptions())
    if (!res) {
      throw new InternalServerErrorException('convert code error')
    }
    !isTest && console.debug(res.code)

    res.code && this.lruCache.set(code, res.code)

    return res.code
  }

  private requireModuleIdSet = new Set<string>()

  @Interval(5 * 60 * 1000)
  private cleanRequireCache() {
    Array.from(this.requireModuleIdSet.values()).forEach((id) => {
      delete require.cache[id]
    })

    this.requireModuleIdSet.clear()
  }

  private resolvePath(id: string) {
    try {
      return this.require.resolve(id)
    } catch {
      try {
        const modulePath = path.resolve(NODE_REQUIRE_PATH, id)
        const resolvePath = this.require.resolve(modulePath)

        return resolvePath
      } catch (err) {
        delete this.require.cache[id]

        isDev && console.error(err)

        throw new InternalServerErrorException(`module "${id}" not found.`)
      }
    }
  }

  private require = isTest
    ? createRequire(resolve(process.cwd(), './node_modules'))
    : createRequire(NODE_REQUIRE_PATH)

  private inNewContextRequire() {
    const __require = (id: string) => {
      const isBuiltin = isBuiltinModule(id)

      const resolvePath = this.resolvePath(id)
      const module = this.require(resolvePath)
      // TODO remove cache in-used package dependencies, because it will not exist in prod
      // eslint-disable-next-line no-empty
      if (Object.keys(PKG.dependencies).includes(id) || isBuiltin) {
      } else {
        this.requireModuleIdSet.add(resolvePath)
      }
      const clonedModule = deepCloneWithFunction(module)
      return clonedModule
    }

    const __requireNoCache = (id: string) => {
      delete this.require.cache[this.resolvePath(id)]
      const clonedModule = __require(id)

      return clonedModule
    }

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
        } catch (err) {
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

      // 2. if application third part lib

      const allowedThirdPartLibs: UniqueArray<
        (keyof typeof PKG.dependencies)[]
      > = [
        '@babel/core',
        '@babel/types',
        '@babel/plugin-transform-typescript',
        'class-validator-jsonschema',
        '@nestjs/event-emitter',
        'algoliasearch',
        'axios-retry',
        'axios',
        'class-transformer',
        'class-validator',
        'dayjs',
        'ejs',
        'image-size',
        'isbot',
        'js-yaml',
        'jszip',
        'lodash',
        'marked',
        'nanoid',
        'qs',
        'rxjs',
        'snakecase-keys',
        'ua-parser-js',
        'xss',
      ]

      const trustPackagePrefixes = ['@innei/', '@mx-space/', 'mx-function-']

      if (
        allowedThirdPartLibs.includes(id as any) ||
        trustPackagePrefixes.some((prefix) => id.startsWith(prefix))
      ) {
        return useCache ? __require(id) : __requireNoCache(id)
      }

      // 3. mock built-in module

      // const mockModules = {
      //   fs: {
      //     writeFile: globalContext.context.writeAsset,
      //     readFile: globalContext.context.readAsset,
      //   },
      // }

      // if (Object.keys(mockModules).includes(id)) {
      //   return mockModules[id]
      // }

      // fin. is built-in module
      const module = isBuiltinModule(id, [
        'child_process',
        'cluster',
        'fs',
        'fs/promises',
        'os',
        'process',
        'sys',
        'v8',
        'vm',
      ])
      if (!module) {
        throw new Error(`cannot require ${id}`)
      } else {
        return __require(id)
      }
    }

    return $require.bind(this)
  }

  async isValidServerlessFunction(raw: string) {
    try {
      // 验证 handler 是否存在并且是函数
      const ast = (await parseAsync(raw, this.getBabelOptions())) as t.File

      const { body } = ast.program as t.Program

      const hasEntryFunction = body.some(
        (node: t.Declaration) =>
          (node.type == 'ExportDefaultDeclaration' &&
            isHandlerFunction(node.declaration)) ||
          isHandlerFunction(node),
      )

      return hasEntryFunction
    } catch (e) {
      if (isDev) {
        console.error(e.message)
      }
      return e.message?.split('\n').at(0)
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
  }
}
