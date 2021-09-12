/*
 * @Author: Innei
 * @Date: 2020-06-11 13:31:05
 * @LastEditTime: 2020-09-02 20:03:18
 * @LastEditors: Innei
 * @FilePath: /mx-web/common/markdown/rules/spoiler.ts
 * @Coding with Love
 */

function tokenizeSpoiler(eat: any, value: string, silent?: boolean): any {
  const match = /^\|\|([\s\S]+?)\|\|(?!\|)/.exec(value)

  if (match) {
    if (silent) {
      return true
    }
    try {
      return eat(match[0])({
        type: 'spoiler',
        value: match[1],
      })
      // eslint-disable-next-line no-empty
    } catch {}
  }
}
tokenizeSpoiler.notInLink = true
tokenizeSpoiler.locator = function (value, fromIndex) {
  return value.indexOf('||', fromIndex)
}

function spoiler(this: any) {
  const Parser = this.Parser as any
  const tokenizers = Parser.prototype.inlineTokenizers
  const methods = Parser.prototype.inlineMethods

  // Add an inline tokenizer (defined in the following example).
  tokenizers.spoiler = tokenizeSpoiler

  // Run it just before `text`.
  methods.splice(methods.indexOf('text'), 0, 'spoiler')
}
export { spoiler }
