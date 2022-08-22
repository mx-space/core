import dayjs from 'dayjs'

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Scope,
} from '@nestjs/common'
import { REQUEST } from '@nestjs/core'

import { ConfigsService } from '~/modules/configs/configs.service'
import { Request } from '~/types/request'
import { deepCloneWithFunction } from '~/utils'
import { safeEval } from '~/utils/safe-eval.util'

const RegMap = {
  '#': /^#(.*?)$/g,
  $: /^\$(.*?)$/g,
  '?': /^\?\??(.*?)\??\?$/g,
} as const

@Injectable({
  scope: Scope.REQUEST,
  durable: true,
})
export class TextMacroService {
  private readonly logger: Logger
  constructor(
    private readonly configService: ConfigsService,
    @Inject(REQUEST) private readonly request: Request,
  ) {
    this.logger = new Logger(TextMacroService.name)
  }

  private ifConditionGrammar<T extends object>(text: string, model: T) {
    const conditionSplitter = text.split('|')
    conditionSplitter.forEach((item: string, index: string | number) => {
      conditionSplitter[index] = item.replace(/"/g, '')
      conditionSplitter[index] = conditionSplitter[index].replace(/\s/g, '')
      conditionSplitter[0] = conditionSplitter[0].replace(/\?/g, '')
      conditionSplitter[conditionSplitter.length - 1] = conditionSplitter[
        conditionSplitter.length - 1
      ].replace(/\?/g, '')
    })

    let output: any
    const condition = conditionSplitter[0].replace('$', '')
    // eslint-disable-next-line no-useless-escape
    const operator = condition.match(/>|==|<|\!=/g)
    if (!operator) {
      throw new BadRequestException('Invalid condition')
    }

    const left = condition.split(operator[0])[0]
    const right = condition.split(operator[0])[1]
    const Value = model[left]
    switch (operator[0]) {
      case '>':
        output = Value > right ? conditionSplitter[1] : conditionSplitter[2]
        break
      case '==':
        output = Value == right ? conditionSplitter[1] : conditionSplitter[2]
        break
      case '<':
        output = Value < right ? conditionSplitter[1] : conditionSplitter[2]
        break
      case '!=':
        output = Value != right ? conditionSplitter[1] : conditionSplitter[2]
        break
      case '&&':
        output = Value && right ? conditionSplitter[1] : conditionSplitter[2]
        break
      case '||':
        output = Value || right ? conditionSplitter[1] : conditionSplitter[2]
        break
      default:
        output = conditionSplitter[1]
        break
    }
    return output
  }

  private generateFunctionContext = (variables: object) => {
    return {
      // time utils
      dayjs: deepCloneWithFunction(dayjs),
      fromNow: (time: Date | string) => dayjs(time).fromNow(),
      onlyMe: (text: string) => {
        return this.request.isMaster ? text : ''
      },

      // typography
      center: (text: string) => {
        return `<p align="center">${text}</p>`
      },
      right: (text: string) => {
        return `<p align="right">${text}</p>`
      },

      // styling
      opacity: (text: string, opacity = 0.8) => {
        return `<span style="opacity: ${opacity}">${text}</span>`
      },
      blur: (text: string, blur = 1) => {
        return `<span style="filter: blur(${blur}px)">${text}</span>`
      },
      color: (text: string, color = '') => {
        return `<span style="color: ${color}">${text}</span>`
      },
      size: (text: string, size = '1em') => {
        return `<span style="font-size: ${size}">${text}</span>`
      },

      ...variables,
    }
  }
  public async replaceTextMacro<T extends object>(
    text: string,
    model: T,

    extraContext: Record<string, any> = {},
  ): Promise<string> {
    const { macros } = await this.configService.get('textOptions')
    if (!macros) {
      return text
    }
    try {
      const matchedReg = /\[\[\s(.*?)\s\]\]/g

      const matched = text.search(matchedReg) != -1

      if (!matched) {
        return text
      }
      // const ast = marked.lexer(text)

      const cacheMap = {} as Record<string, any>

      text = text.replace(matchedReg, (match, condition) => {
        // FIXME: shallow find, if same text both in code block and paragraph, the macro in paragraph also will not replace
        // const isInCodeBlock = ast.some((i) => {
        //   if (i.type === 'code' || i.type === 'codespan') {
        //     return i.raw.includes(condition)
        //   }
        // })

        // if (isInCodeBlock) {
        //   return match
        // }

        condition = condition?.trim()
        if (condition.search(RegMap['?']) != -1) {
          return this.ifConditionGrammar(condition, model)
        }
        if (condition.search(RegMap['$']) != -1) {
          const variable = condition
            .replace(RegMap['$'], '$1')
            .replace(/\s/g, '')
          return model[variable] ?? extraContext[variable]
        }
        // eslint-disable-next-line no-useless-escape
        if (condition.search(RegMap['#']) != -1) {
          // eslint-disable-next-line no-useless-escape
          const functions = condition.replace(RegMap['#'], '$1')

          if (typeof cacheMap[functions] != 'undefined') {
            return cacheMap[functions]
          }

          const variables = Object.keys(model).reduce(
            (acc, key) => ({ [`$${key}`]: model[key], ...acc }),
            {},
          )

          try {
            const result = safeEval(
              `return ${functions}`,
              this.generateFunctionContext({ ...variables, ...extraContext }),

              { timeout: 1000 },
            )
            cacheMap[functions] = result
            return result
          } catch {
            return match
          }
        }
      })

      return text
    } catch (err) {
      this.logger.log(err.message)
      return text
    }
  }
}
