import { factory } from '@innei/prettier'

export default {
  ...factory({
    tailwindcss: false,
  }),
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
}
