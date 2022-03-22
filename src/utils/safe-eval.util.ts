import vm2 from 'vm2'
export function safeEval(code: string, context = {}) {
  const sandbox = {
    global: {},
  }

  code = `((async () => { ${code} })())`
  if (context) {
    Object.keys(context).forEach((key) => {
      sandbox[key] = context[key]
    })
  }

  const VM = new vm2.VM({
    timeout: 60_0000,
    sandbox,

    eval: false,
  })

  return VM.run(code)
}
