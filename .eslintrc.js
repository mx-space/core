module.exports = {
  extends: ['@innei/eslint-config-ts'],
  root: true,
  plugins: ['unused-imports', '@typescript-eslint'],
  rules: {
    'no-empty': 'warn',
    'no-fallthrough': 'error',
    'no-unused-vars': 'off', // or "@typescript-eslint/no-unused-vars": "off",
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'no-type-imports',
      },
    ],
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
  },
}
