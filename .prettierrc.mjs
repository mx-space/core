import sortPlugin from '@ianvs/prettier-plugin-sort-imports'
import jsonPlugin from 'prettier-package-json'

export default {
  singleQuote: true,
  semi: false,
  trailingComma: 'all',
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  tabWidth: 2,
  printWidth: 80,

  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: [jsonPlugin, sortPlugin],
}
