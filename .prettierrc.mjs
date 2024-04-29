import { factory } from '@innei/prettier'

export default {
  ...factory({
    tailwindcss: false,
    importSort: false,
  }),
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
}
