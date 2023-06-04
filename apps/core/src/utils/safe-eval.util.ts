import vm2 from 'vm2'

export function safeEval(code: string, context = {}, options?: vm2.VMOptions) {
  const sandbox = {
    global: {},
  }

  code = `((() => { ${code} })())`
  if (context) {
    Object.keys(context).forEach((key) => {
      sandbox[key] = context[key]
    })
  }

  const VM = new vm2.VM({
    timeout: 60_0000,
    sandbox,

    eval: false,
    ...options,
  })

  return VM.run(code)
}
