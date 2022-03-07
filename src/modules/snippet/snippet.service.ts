import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { load } from 'js-yaml'
import { InjectModel } from 'nestjs-typegoose'
import { safeEval } from '~/utils/safe-eval.util'
import { SnippetModel, SnippetType } from './snippet.model'
@Injectable()
export class SnippetService {
  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: MongooseModel<SnippetModel>,
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

    return await this.model.findByIdAndUpdate(id, { ...model }, { new: true })
  }

  async delete(id: string) {
    await this.model.deleteOne({ _id: id })
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
      case SnippetType.YAML: {
        try {
          load(model.raw)
        } catch {
          throw new BadRequestException('content is not valid yaml')
        }
        break
      }
      case SnippetType.Function: {
        const isValid = await this.isValidServerlessFunction(model.raw)
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

  async injectContextIntoServerlessFunctionAndCall(functionString: string) {
    return await safeEval(`${functionString}; return handler()`)
  }

  async isValidServerlessFunction(raw: string) {
    try {
      return safeEval(`
    ${raw}
    // 验证 handler 是否存在并且是函数
    return typeof handler === 'function'
    `)
    } catch (e) {
      return false
    }
  }

  async getSnippetById(id: string) {
    const doc = await this.model.findById(id).lean()
    return this.attachSnippet(doc)
  }

  /**
   *
   * @param name
   * @param reference 引用类型, 可以理解为 type
   * @returns
   */
  async getSnippetByName(name: string, reference: string) {
    const doc = await this.model.findOne({ name, reference }).lean()
    return this.attachSnippet(doc)
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
      case SnippetType.YAML: {
        Reflect.set(model, 'data', load(model.raw))
        break
      }
      case SnippetType.Text: {
        Reflect.set(model, 'data', model.raw)
        break
      }

      case SnippetType.Function: {
        const res = await this.injectContextIntoServerlessFunctionAndCall(
          model.raw,
        )
        Reflect.set(model, 'data', res)
        break
      }
    }

    return model as SnippetModel & { data: any }
  }
}
