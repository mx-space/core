import type { TransformOptions } from '@babel/core'
import type * as t from '@babel/types'
import type { VariableDeclaration } from '@babel/types'

import BabelPluginTransformCommonJS from '@babel/plugin-transform-modules-commonjs'
import BabelPluginTransformTS from '@babel/plugin-transform-typescript'

export const hashStable = (str: string): string => {
  let hash = 5381
  let i = str.length

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }

  return (hash >>> 0).toString(36)
}

export const complieTypeScriptBabelOptions: TransformOptions = {
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
          VariableDeclaration(path: babel.NodePath) {
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
