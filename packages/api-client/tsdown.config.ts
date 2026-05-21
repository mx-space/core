import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'tsdown'

const __dirname = new URL(import.meta.url).pathname.replace(/\/[^/]*$/, '')

const adaptorNames = readdirSync(path.resolve(__dirname, './adaptors')).map(
  (i) => path.parse(i).name,
)

export default defineConfig({
  clean: true,
  target: 'es2020',
  entry: [
    'index.ts',
    'legacy/index.ts',
    ...adaptorNames.map((name) => `adaptors/${name}.ts`),
  ],
  external: adaptorNames,
  // `eager: true` runs the TypeScript compiler directly to emit declarations
  // instead of relying on rolldown-plugin-dts's bundler. The bundler chokes
  // on the long re-export chain `@core/constants/db.constant → @mx-space/db-schema`
  // (see "Export 'CollectionRefTypes' is not defined" — sxzz/rolldown-plugin-dts
  // can't follow workspace re-exports through a private package), and `eager`
  // sidesteps the issue cleanly.
  dts: { eager: true },
  format: ['cjs', 'esm'],
  onSuccess() {
    // Module augmentations for HTTPClient must live in the root entry d.ts so
    // TypeScript merges them with the re-exported class. When rolldown-plugin-dts
    // splits declarations into chunks, augmentations land in chunk files where
    // they never reach consumer projects. We:
    //   1. Rewrite augment target `'../core/client'` → `'<pkg>'` everywhere.
    //   2. Strip the augmentation blocks from chunk files.
    //   3. Append them to the root index.d.cts / index.d.mts so consumers see them.
    const PKG = JSON.parse(
      readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'),
    )
    const distRoot = path.resolve(__dirname, './dist')
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const resolved = path.join(dir, entry.name)
        if (entry.isDirectory()) return walk(resolved)
        return /\.d\.(c|m)?ts$/.test(entry.name) ? [resolved] : []
      })

    const augmentPattern = new RegExp(
      `declare module ['"](?:\\.\\./core/client|${PKG.name.replace(/[/\\\\^$*+?.()|[\\]{}]/g, '\\$&')})['"]\\s*\\{[\\s\\S]*?^\\}`,
      'gm',
    )
    const collected = new Set<string>()

    for (const file of walk(distRoot)) {
      const isRootEntry =
        file === path.join(distRoot, 'index.d.cts') ||
        file === path.join(distRoot, 'index.d.mts')
      let content = readFileSync(file, 'utf-8')

      content = content.replaceAll(
        /declare module ['"]\.\.\/core\/client['"]/g,
        `declare module '${PKG.name}'`,
      )

      if (!isRootEntry) {
        const matches = content.match(augmentPattern)
        if (matches?.length) {
          matches.forEach((m) => collected.add(m.trim()))
          content = content.replaceAll(augmentPattern, '').replace(/\n{3,}/g, '\n\n')
        }
      }

      writeFileSync(file, content)
    }

    if (collected.size === 0) return

    for (const root of ['index.d.cts', 'index.d.mts']) {
      const file = path.join(distRoot, root)
      const content = readFileSync(file, 'utf-8')
      const block = ['', '// --- HTTPClient augmentations (inlined) ---', ...collected].join('\n')
      writeFileSync(file, content.trimEnd() + '\n' + block + '\n')
    }
  },
})
