import { defineConfig } from '@lobehub/oxlint-config'

export default defineConfig(
  {
    ignores: [
      'assets/types/type.declare.ts',
      'node_modules',
      'dist',
      'out',
      'packages/*/node_modules',
      'packages/*/dist',
      'packages/*/out',
      'packages/*/lib',
      'packages/*/build',
      'packages/*/coverage',
      'packages/*/test',
      'packages/*/tests',
      'packages/*/esm',
      'packages/*/types',
      'test/**/*.db.ts',
      // Raw-eval'd worker script (`?raw` import), not a compiled module
      'apps/core/src/utils/sandbox/sandbox-worker.runtime.js',
      // Ambient declarations served raw to Monaco, excluded from tsc
      'apps/core/src/utils/sandbox/sandbox-type-declaration.runtime.d.ts',
    ],
    // Imports are sorted by prettier-plugin-sort-imports.
    sortImports: false,
    sortKeys: false,
    typescript: true,
    react: false,
    reactCompiler: false,
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      eqeqeq: 'off',
      'no-void': 'off',
      // for node server runtime
      'require-await': 'off',
      'unicorn/import-style': 'off',
      'unicorn/number-literal-case': 'off',
      'unicorn/text-encoding-identifier-case': 'off',
      // Nest DI and emitDecoratorMetadata need value imports, not `import type`.
      'typescript/consistent-type-imports': 'off',
      'typescript/no-unsafe-function-type': 'off',
    },
  },
  {
    files: [
      'apps/core/src/migration/**',
      'apps/core/src/modules/serverless/pack/**',
      'apps/core/test/**',
    ],
    rules: {
      'no-restricted-exports': 'off',
    },
  },
  {
    files: ['apps/admin/src/models/analyze.ts'],
    rules: {
      // Ambient type declaration namespace, not a runtime namespace.
      'typescript/no-namespace': 'off',
    },
  },
)
