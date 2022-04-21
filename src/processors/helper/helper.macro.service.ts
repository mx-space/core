import dayjs from 'dayjs'
import { marked } from 'marked'

import { BadRequestException, Injectable } from '@nestjs/common'

import { deepCloneWithFunction } from '~/utils'
import { safeEval } from '~/utils/safe-eval.util'

@Injectable()
export class TextMacroService {
  static readonly Reg = {
    '#': /^#(.*?)$/g,
    $: /^\$(.*?)$/g,
    '?': /^\?\??(.*?)\??\?$/g,
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

  public async replaceTextMacro<T extends object>(
    text: string,
    model: T,
  ): Promise<string> {
    const matchedReg = /\[\[\s(.*?)\s\]\]/g
    if (text.search(matchedReg) != -1) {
      text = text.replace(matchedReg, (match, condition) => {
        const ast = marked.lexer(text)

        // FIXME: shallow find, if same text both in code block and paragraph, the macro in paragraph also will not replace
        const isInCodeBlock = ast.some((i) => {
          if (i.type === 'code' || i.type === 'codespan') {
            return i.raw.includes(condition)
          }
        })

        if (isInCodeBlock) {
          return match
        }

        condition = condition?.trim()
        if (condition.search(TextMacroService.Reg['?']) != -1) {
          return this.ifConditionGrammar(condition, model)
        }
        if (condition.search(TextMacroService.Reg['$']) != -1) {
          const variable = condition
            .replace(TextMacroService.Reg['$'], '$1')
            .replace(/\s/g, '')
          return model[variable]
        }
        // eslint-disable-next-line no-useless-escape
        if (condition.search(TextMacroService.Reg['#']) != -1) {
          // eslint-disable-next-line no-useless-escape
          const functions = condition.replace(TextMacroService.Reg['#'], '$1')

          const variables = Object.keys(model).reduce(
            (acc, key) => ({ [`$${key}`]: model[key], ...acc }),
            {},
          )

          // TODO catch error
          return safeEval(`return ${functions}`, {
            dayjs: deepCloneWithFunction(dayjs),
            fromNow: (time: Date | string) => dayjs(time).fromNow(),

            ...variables,
          })
        }
      })
    }
    return text
  }
}
