import type { InputOptions, NodePath } from '@babel/core'
import type * as t from '@babel/types'
import type { VariableDeclaration } from '@babel/types'

const interopDefault = <T>(mod: T | { default: T }): T =>
  (mod as { default: T }).default ?? (mod as T)

let optionsPromise: Promise<InputOptions> | undefined

// Babel is only needed when a snippet is (re)compiled — a cold path whose
// result is persisted in `compiledCode` — so the whole toolchain is loaded
// lazily to keep it out of the boot heap.
export const getCompileTypeScriptBabelOptions = (): Promise<InputOptions> =>
  (optionsPromise ??= buildOptions())

const buildOptions = async (): Promise<InputOptions> => {
  const [BabelPluginTransformTS, BabelPluginTransformCommonJS] =
    await Promise.all([
      import('@babel/plugin-transform-typescript').then(interopDefault),
      import('@babel/plugin-transform-modules-commonjs').then(interopDefault),
    ])
  return {
    comments: false,
    plugins: [
      BabelPluginTransformTS,
      [
        BabelPluginTransformCommonJS,
        { allowTopLevelThis: false, importInterop: 'node' },
      ],
      function transformImport() {
        return {
          visitor: {
            VariableDeclaration(path: NodePath) {
              const node = path.node as VariableDeclaration
              if (
                node.kind === 'var' &&
                node.declarations[0].init?.type === 'CallExpression' &&
                (
                  (node.declarations[0].init as t.CallExpression)
                    .callee as t.Identifier
                )?.name === 'require'
              ) {
                const callee = node.declarations[0].init

                const _await: t.AwaitExpression = {
                  argument: node.declarations[0].init,
                  type: 'AwaitExpression',
                  start: callee.start,
                  end: callee.end,
                  innerComments: [],
                  loc: callee.loc,
                  leadingComments: [],
                  trailingComments: [],
                }
                node.declarations[0].init = _await
              }
            },
          },
        }
      },
    ],
  }
}
