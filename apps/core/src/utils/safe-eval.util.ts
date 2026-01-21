import vm from 'node:vm'

interface SafeEvalOptions {
  timeout?: number
}

/**
 * Simple synchronous code evaluation using Node.js vm module.
 *
 * WARNING: This is NOT a secure sandbox. The vm module does not provide
 * security isolation. Use SandboxService for untrusted code execution.
 *
 * This function is intended for:
 * - Simple template expressions
 * - Trusted internal code evaluation
 * - Macro processing
 *
 * @deprecated For serverless functions, use SandboxService instead.
 */
export function safeEval<T = unknown>(
  code: string,
  context: Record<string, unknown> = {},
  options?: SafeEvalOptions,
): T {
  const sandbox = {
    global: {},
    ...context,
  }

  const wrappedCode = `((() => { ${code} })())`

  const vmContext = vm.createContext(sandbox, {
    codeGeneration: {
      strings: false,
      wasm: false,
    },
  })

  return vm.runInContext(wrappedCode, vmContext, {
    timeout: options?.timeout ?? 60000,
    breakOnSigint: true,
  }) as T
}
