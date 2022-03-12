import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { load } from 'js-yaml'
import { InjectModel } from 'nestjs-typegoose'
import { ServerlessService } from '../serverless/serverless.service'
import { SnippetModel, SnippetType } from './snippet.model'

@Injectable()
export class SnippetService {
  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: MongooseModel<SnippetModel>,
    @Inject(forwardRef(() => ServerlessService))
    private readonly serverlessService: ServerlessService,
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
        const isValid = await this.serverlessService.isValidServerlessFunction(
          model.raw,
        )
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
    const doc = await this.model.findOne({ name, reference }).lean()
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
}
