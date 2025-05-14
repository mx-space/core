import { sxzz } from '@sxzz/eslint-config'

export default sxzz(
  {
    markdown: false,
    prettier: true,
    pnpm: false,
    vue: false,
    unocss: false,
    sortKeys: false,
  },
  [
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
      ],
      languageOptions: {
        parserOptions: {
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
        },
      },
      rules: {
        eqeqeq: 'off',

        'no-void': 0,
        '@typescript-eslint/consistent-type-assertions': 0,
        'no-restricted-syntax': 0,
        'unicorn/filename-case': 0,
        'unicorn/prefer-math-trunc': 0,

        'unused-imports/no-unused-imports': 'error',

        'unused-imports/no-unused-vars': [
          'error',
          {
            vars: 'all',
            varsIgnorePattern: '^_',
            args: 'after-used',
            argsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],

        // for node server runtime
        'require-await': 0,
        '@typescript-eslint/no-unsafe-function-type': 0,
        'unicorn/no-array-callback-reference': 0,

        'node/prefer-global/process': 0,
        'node/prefer-global/buffer': 'off',
        'no-duplicate-imports': 'off',
        'unicorn/explicit-length-check': 0,
        'unicorn/prefer-top-level-await': 0,
        // readable push syntax
        'unicorn/no-array-push-push': 0,
        '@typescript-eslint/no-require-imports': 0,
        'perfectionist/sort-imports': 0,
      },
    },
    {
      files: ['packages/api-client/**/*.ts'],
      rules: { 'unused-imports/no-unused-vars': 0 },
    },

    {
      files: [
        'apps/core/src/migration/**/*.ts',
        'apps/core/src/modules/serverless/pack/**/*.ts',
        'apps/core/test/**/*.ts',
      ],
      rules: {
        'import/no-default-export': 'off',
      },
    },
  ],
)
