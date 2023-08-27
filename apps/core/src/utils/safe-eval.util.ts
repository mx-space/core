import ivm from 'isolated-vm'
import { merge } from 'lodash'

export async function safeEval(
  code: string,
  context = {},
  options?: ivm.IsolateOptions & {
    timeout?: number
  },
) {
  const { timeout, ...insolateOptions } = options || {}
  const vm = new ivm.Isolate(
    merge(
      {
        memoryLimit: 10,
      },
      insolateOptions,
    ),
  )
  const vmContext = vm.createContextSync()

  const sandbox = Object.create(null)
  if (context) {
    Object.keys(context).forEach((key) => {
      sandbox[key] = context[key]
    })
  }

  Object.keys(sandbox).forEach((key) => {
    vmContext.global.set(key, sandbox[key])
  })

  code = `((() => { ${code} })())`

  const script = await vm.compileScript(code)

  const result = await script.run(vmContext, {})
  return result
}
