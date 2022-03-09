import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { isURL } from 'class-validator'
import fs from 'fs/promises'
import { load } from 'js-yaml'
import { cloneDeep } from 'lodash'
import { InjectModel } from 'nestjs-typegoose'
import type PKG from '~/../package.json'
import { DATA_DIR } from '~/constants/path.constant'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { UniqueArray } from '~/ts-hepler/unique'
import { safePathJoin } from '~/utils'
import { safeEval } from '~/utils/safe-eval.util'
import { isBuiltinModule } from '~/utils/sys.util'
import { SnippetModel, SnippetType } from './snippet.model'

@Injectable()
export class SnippetService {
  constructor(
    @InjectModel(SnippetModel)
    private readonly snippetModel: MongooseModel<SnippetModel>,
    private readonly assetService: AssetService,
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

  async injectContextIntoServerlessFunctionAndCall(model: SnippetModel) {
    const { raw: functionString } = model
    const logger = new Logger('serverless-function')
    const document = await this.model.findById(model.id)
    const global = {
      context: {
        model,
        document,
        name: model.name,
        reference: model.reference,

        // TODO
        // write file to asset
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
        // read file to asset
        readAsset: async (
          path: string,
          options: Parameters<typeof fs.readFile>[1],
        ) => {
          return await this.assetService.getAsset(safePathJoin(path), options)
        },
      },
      // inject global
      __dirname: DATA_DIR,

      // inject some zx utils
      fetch,

      // inject logger
      console: logger,
      logger,

      require: async (id: string) => {
        if (!id || typeof id !== 'string') {
          throw new Error('require id is not valid')
        }

        // 1. if is remote module
        if (
          isURL(id, { protocols: ['http', 'https'], require_protocol: true })
        ) {
          const res = await fetch(id)
          const text = await res.text()
          return await safeEval(text)
        }

        // 2. if application third part lib

        const allowedThirdPartLibs: UniqueArray<
          (keyof typeof PKG.dependencies)[]
        > = [
          'algoliasearch',
          'axios-retry',
          'axios',
          'class-transformer',
          'class-validator',
          'dayjs',
          'ejs',
          'html-minifier',
          'image-size',
          'isbot',
          'js-yaml',
          'jsdom',
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

        if (allowedThirdPartLibs.includes(id as any)) {
          return cloneDeep(require(id))
        }

        // 3. mock built-in module

        const mockModules = {
          fs: {
            writeFile: global.context.writeAsset,
            readFile: global.context.readAsset,
          },
        }

        if (Object.keys(mockModules).includes(id)) {
          return mockModules[id]
        }
        // fin. is built-in module
        const module = isBuiltinModule(id, ['fs', 'os', 'child_process', 'sys'])
        if (!module) {
          throw new Error(`cannot require ${id}`)
        } else {
          return cloneDeep(require(id))
        }
      },
      process: {
        env: Object.freeze({ ...process.env }),
        nextTick: process.nextTick,
        cwd: process.cwd,
      },
    }

    return await safeEval(
      `${functionString}; return handler(context, require)`,
      { ...global, global },
    )
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
    if (!doc) {
      throw new NotFoundException()
    }
    return doc
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
        const res = await this.injectContextIntoServerlessFunctionAndCall(model)
        Reflect.set(model, 'data', res)
        break
      }
    }

    return model as SnippetModel & { data: any }
  }
}
