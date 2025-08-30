import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { RequestContext } from '~/common/contexts/request.context'
import { ConfigsService } from '~/modules/configs/configs.service'
import { safeEval } from '~/utils/safe-eval.util'
import { deepCloneWithFunction } from '~/utils/tool.util'
import dayjs from 'dayjs'

const RegMap = {
  '#': /^#(.*)$/g,
  $: /^\$(.*)$/g,
  '?': /^\?\??(.*?)\??\?$/g,
} as const

@Injectable({})
export class TextMacroService {
  private readonly logger: Logger
  constructor(private readonly configService: ConfigsService) {
    this.logger = new Logger(TextMacroService.name)
  }

  private ifConditionGrammar<T extends object>(text: string, model: T) {
    const conditionSplitter = text.split('|')
    conditionSplitter.forEach((item: string, index: string | number) => {
      conditionSplitter[index] = item.replaceAll('"', '')
      conditionSplitter[index] = conditionSplitter[index].replaceAll(/\s/g, '')
      conditionSplitter[0] = conditionSplitter[0].replaceAll('?', '')
      const lastValue = conditionSplitter?.at(-1)?.replaceAll('?', '')
      if (lastValue) conditionSplitter[conditionSplitter.length - 1] = lastValue
    })

    let output: any
    const condition = conditionSplitter[0].replace('$', '')

    const operator = condition.match(/>|==|<|!=/g)
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
        return RequestContext.currentIsAuthenticated() ? text : ''
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

      text = text.replaceAll(matchedReg, (match, condition) => {
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
        if (condition.search(RegMap.$) != -1) {
          const variable = condition
            .replaceAll(RegMap.$, '$1')
            .replaceAll(/\s/g, '')
          return model[variable] ?? extraContext[variable]
        }

        if (condition.search(RegMap['#']) != -1) {
          const functions = condition.replaceAll(RegMap['#'], '$1')

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
    } catch (error) {
      this.logger.log(error.message)
      return text
    }
  }
}
