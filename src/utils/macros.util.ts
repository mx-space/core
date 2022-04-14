/* eslint-disable no-useless-escape */
const Reg = {
  '#': /\#(.*?)/g,
  $: /\$(.*?)/g,
  '?': /\?\??(.*?)\??\?/g,
}

function ifConditionGramar(condition: string, model: any) {
  const conditionStr = condition.split('|')
  conditionStr.forEach((item: string, index: string | number) => {
    conditionStr[index] = item.replace(/"/g, '')
    conditionStr[index] = conditionStr[index].replace(/\s/g, '')
    conditionStr[0] = conditionStr[0].replace(/\?/g, '')
    conditionStr[conditionStr.length - 1] = conditionStr[
      conditionStr.length - 1
    ].replace(/\?/g, '')
  })
  return ifConditionMacro(conditionStr, model)
}
function ifConditionMacro(args: any, data: any) {
  let output: any
  const condition = args[0].replace('$', '')
  // eslint-disable-next-line no-useless-escape
  const operator = condition.match(/>|==|<|\!=/g)
  const left = condition.split(operator)[0]
  const right = condition.split(operator)[1]
  const Value = data[left]
  switch (operator[0]) {
    case '>':
      output = Value > right ? args[1] : args[2]
      break
    case '==':
      output = Value == right ? args[1] : args[2]
      break
    case '<':
      output = Value < right ? args[1] : args[2]
      break
    case '!=':
      output = Value != right ? args[1] : args[2]
      break
    case '&&':
      output = Value && right ? args[1] : args[2]
      break
    case '||':
      output = Value || right ? args[1] : args[2]
      break
    default:
      output = args[1]
      break
  }
  return output
}
export function macros(str: any, model: any): any {
  if (str.search(/\[\[(.*?)\]\]/g) != -1) {
    str = str.replace(/\[\[(.*?)\]\]/g, (match, condition) => {
      if (condition.search(Reg['?']) != -1) {
        return ifConditionGramar(condition, model)
      }
      if (condition.search(Reg['$']) != -1) {
        const variable = condition.replace(Reg['$'], '$1').replace(/\s/g, '')
        return model[variable]
      }
      // eslint-disable-next-line no-useless-escape
      if (condition.search(Reg['#']) != -1) {
        // eslint-disable-next-line no-useless-escape
        const functions = condition.replace(Reg['#'], '$1').replace(/\s/g, '')
      }
    })
  }
  return str
}
