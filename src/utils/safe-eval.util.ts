import { customAlphabet } from 'nanoid'
import vm from 'vm'
const nanoid = customAlphabet(
  '0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$',
  16,
)
export function safeEval(
  code: string,
  context = {},
  opts?: string | vm.RunningScriptOptions,
) {
  const sandbox = {}
  const resultKey = 'SAFE_EVAL_' + nanoid()
  sandbox[resultKey] = {}
  const clearContext = `
    (function() {
      Function = undefined;
      const keys = Object.getOwnPropertyNames(this).concat(['constructor']);
      keys.forEach((key) => {
        const item = this[key];
        if (!item || typeof item.constructor !== 'function') return;
        this[key].constructor = undefined;
      });
    })();
  `
  code = clearContext + resultKey + '=' + `((() => { ${code} })())`
  if (context) {
    Object.keys(context).forEach(function (key) {
      sandbox[key] = context[key]
    })
  }
  vm.runInNewContext(code, sandbox, opts)
  return sandbox[resultKey]
}
