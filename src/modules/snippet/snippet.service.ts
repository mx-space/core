import { load } from 'js-yaml'
import JSON5 from 'json5'

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
    private readonly snippetModel: MongooseModel<SnippetModel>,
    @Inject(forwardRef(() => ServerlessService))
    private readonly serverlessService: ServerlessService,
    private readonly cacheService: CacheService,
  ) {}

  get model() {
    return this.snippetModel
  }

  async create(model: SnippetModel) {
    const isExist = await this.model.countDocuments({
      name: model.name,
      reference: model.reference || 'root',
    })

    if (isExist) {
      throw new BadRequestException('snippet is exist')
    }
    // 验证正确类型
    await this.validateType(model)
    return await this.model.create({ ...model, created: new Date() })
  }

  async update(id: string, model: SnippetModel) {
    await this.validateType(model)
    delete model.created
    const old = await this.model.findById(id).lean()
    if (!old) {
      throw new NotFoundException()
    }
    await this.deleteCachedSnippet(old.reference, old.name)
    return await this.model.findByIdAndUpdate(
      id,
      { ...model, modified: new Date() },
      { new: true },
    )
  }

  async delete(id: string) {
    const doc = await this.model.findOneAndDelete({ _id: id }).lean()
    if (!doc) {
      throw new NotFoundException()
    }
    await this.deleteCachedSnippet(doc.reference, doc.name)
  }

  private async validateType(model: SnippetModel) {
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
  }

  async getSnippetById(id: string) {
    const doc = await this.model.findById(id).lean()
    if (!doc) {
      throw new NotFoundException()
    }
    return doc
  }

  /**
   *
   * @param name
   * @param reference 引用类型, 可以理解为 type, 或者一级分类
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
