import { load } from 'js-yaml'
import JSON5 from 'json5'
import { AggregatePaginateModel, Document } from 'mongoose'
import qs from 'qs'

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/redis/cache.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils'

import { ServerlessService } from '../serverless/serverless.service'
import { SnippetModel, SnippetType } from './snippet.model'

@Injectable()
export class SnippetService {
  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: MongooseModel<SnippetModel> &
      AggregatePaginateModel<SnippetModel & Document>,
    @Inject(forwardRef(() => ServerlessService))
    private readonly serverlessService: ServerlessService,
    private readonly cacheService: CacheService,
  ) {}

  get model() {
    return this.snippetModel
  }

  async create(model: SnippetModel) {
    if (model.type === SnippetType.Function) {
      model.method ??= 'GET'
      model.enable ??= true
    }
    const isExist = await this.model.countDocuments({
      name: model.name,
      reference: model.reference || 'root',
      method: model.method,
    })

    if (isExist) {
      throw new BadRequestException('snippet is exist')
    }
    // 验证正确类型
    await this.validateTypeAndCleanup(model)
    return await this.model.create({ ...model, created: new Date() })
  }

  async update(id: string, newModel: SnippetModel) {
    await this.validateTypeAndCleanup(newModel)
    delete newModel.created
    const old = await this.model.findById(id).select('+secret').lean()

    if (!old) {
      throw new NotFoundException()
    }

    if (
      old.type === SnippetType.Function &&
      newModel.type !== SnippetType.Function
    ) {
      throw new BadRequestException(
        '`type` is not allowed to change if this snippet set to Function type.',
      )
    }

    // merge secret
    if (old.secret && newModel.secret) {
      const oldSecret = qs.parse(old.secret)
      const newSecret = qs.parse(newModel.secret)

      // first delete key if newer secret not provide
      for (const key in oldSecret) {
        if (!(key in newSecret)) {
          delete oldSecret[key]
        }
      }

      for (const key in newSecret) {
        // if newSecret has same key, but value is empty, remove it

        if (newSecret[key] === '' && oldSecret[key] !== '') {
          delete newSecret[key]
        }
      }

      newModel.secret = qs.stringify({ ...oldSecret, ...newSecret })
    }

    await this.deleteCachedSnippet(old.reference, old.name)
    const newerDoc = await this.model.findByIdAndUpdate(
      id,
      { ...newModel, modified: new Date() },
      { new: true },
    )
    if (newerDoc) {
      const nextSnippet = this.transformLeanSnippetModel(newerDoc.toObject())

      return nextSnippet
    }
    return newerDoc
  }

  async delete(id: string) {
    const doc = await this.model.findOneAndDelete({ _id: id }).lean()
    if (!doc) {
      throw new NotFoundException()
    }
    await this.deleteCachedSnippet(doc.reference, doc.name)
  }

  private async validateTypeAndCleanup(model: SnippetModel) {
    switch (model.type) {
      case SnippetType.JSON: {
        try {
          JSON.parse(model.raw)
        } catch {
          throw new BadRequestException('content is not valid json')
        }
        break
      }
      case SnippetType.JSON5: {
        try {
          JSON5.parse(model.raw)
        } catch {
          throw new BadRequestException('content is not valid json5')
        }
        break
      }
      case SnippetType.YAML: {
        try {
          load(model.raw)
        } catch {
          throw new BadRequestException('content is not valid yaml')
        }
        break
      }
      case SnippetType.Function: {
        const isValid = await this.serverlessService.isValidServerlessFunction(
          model.raw,
        )
        // if isValid is string, eq error message
        if (typeof isValid === 'string') {
          throw new BadRequestException(isValid)
        }
        if (!isValid) {
          throw new BadRequestException('serverless function is not valid')
        }
        break
      }

      case SnippetType.Text:
      default: {
        break
      }
    }
    // TODO refactor
    // cleanup
    if (model.type !== SnippetType.Function) {
      const deleteKeys: (keyof SnippetModel)[] = ['enable', 'method', 'secret']
      deleteKeys.forEach((key) => {
        Reflect.deleteProperty(model, key)
      })
    }
  }

  async getSnippetById(id: string) {
    const doc = await this.model.findById(id).select('+secret').lean({
      getters: true,
    })
    if (!doc) {
      throw new NotFoundException()
    }

    // transform sth.
    const nextSnippet = this.transformLeanSnippetModel(doc)

    return nextSnippet
  }

  private transformLeanSnippetModel(snippet: SnippetModel) {
    const nextSnippet = { ...snippet }
    // transform sth.
    if (snippet.type === SnippetType.Function) {
      if (snippet.secret) {
        const secretObj = qs.parse(snippet.secret)

        for (const key in secretObj) {
          // remove secret value, only keep key
          secretObj[key] = ''
        }
        nextSnippet.secret = secretObj as any
      }
    }

    return nextSnippet
  }

  /**
   *
   * @param name
   * @param reference 引用类型，可以理解为 type, 或者一级分类
   * @returns
   */
  async getSnippetByName(name: string, reference: string) {
    const doc = await this.model
      .findOne({ name, reference, type: { $ne: SnippetType.Function } })
      .lean()
    if (!doc) {
      throw new NotFoundException('snippet is not found')
    }
    return doc
  }

  async attachSnippet(model: SnippetModel) {
    if (!model) {
      throw new NotFoundException()
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

    return model as SnippetModel & { data: any }
  }

  async cacheSnippet(model: SnippetModel, value: any) {
    const { reference, name } = model
    const key = `${reference}:${name}:${model.private ? 'private' : ''}`
    const client = this.cacheService.getClient()
    await client.hset(
      getRedisKey(RedisKeys.SnippetCache),
      key,
      typeof value !== 'string' ? JSON.stringify(value) : value,
    )
  }
  async getCachedSnippet(
    reference: string,
    name: string,
    accessType: 'public' | 'private',
  ) {
    const key = `${reference}:${name}:${
      accessType === 'private' ? 'private' : ''
    }`
    const client = this.cacheService.getClient()
    const value = await client.hget(getRedisKey(RedisKeys.SnippetCache), key)
    return value
  }
  async deleteCachedSnippet(reference: string, name: string) {
    const keyBase = `${reference}:${name}`
    const key1 = `${keyBase}:`
    const key2 = `${keyBase}:private`

    const client = this.cacheService.getClient()
    await Promise.all(
      [key1, key2].map((key) => {
        return client.hdel(getRedisKey(RedisKeys.SnippetCache), key)
      }),
    )
  }
}
