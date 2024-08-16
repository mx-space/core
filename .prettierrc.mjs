import { factory } from '@innei/prettier'

export default {
  ...factory({
    tailwindcss: false,
    importSort: true,
  }),
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
}
