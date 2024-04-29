import { sxzz } from '@sxzz/eslint-config'

export default sxzz(
  [
    /* your custom config */
    {
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
      },
    },
  ],
  // Features: it'll detect installed dependency and enable necessary features automatically
  {
    prettier: true,
    markdown: true,
    vue: false, // auto detection
    unocss: false, // auto detection
  },
)
