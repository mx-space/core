import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'tsdown'

const __dirname = new URL(import.meta.url).pathname.replace(/\/[^/]*$/, '')

const adaptorNames = readdirSync(path.resolve(__dirname, './adaptors')).map(
  (i) => path.parse(i).name,
)

function isThirdPartyPackageId(id: string): boolean {
  if (id.includes('node_modules')) return true
  if (id.startsWith('.') || id.startsWith('/') || path.isAbsolute(id)) {
    return false
  }
  if (id.startsWith('@core') || id.startsWith('@mx-space')) return false
  return id.startsWith('@') || /^[a-z]/i.test(id)
}

export default defineConfig({
  clean: true,
  target: 'es2020',
  entry: [
    'index.ts',
    'legacy/index.ts',
    ...adaptorNames.map((name) => `adaptors/${name}.ts`),
  ],
  deps: {
    neverBundle: adaptorNames,
    // rolldown-plugin-dts treats type-only re-exports in third-party .d.ts as
    // value imports (drizzle-orm NeonAuthToken, zod locales, axios AxiosInstance,
    // …) and fails the dts bundle. Keep workspace types inlined; externalize the rest.
    dts: {
      neverBundle: (id) => isThirdPartyPackageId(id),
    },
  },
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
        return /\.d\.[cm]?ts$/.test(entry.name) ? [resolved] : []
      })

    const escapedPkg = PKG.name.replaceAll(
      /[$()*+./?[\\\]^{|}-]/g,
      String.raw`\$&`,
    )
    const augmentPattern = new RegExp(
      `declare module ['"](?:\\.\\./core/client|${escapedPkg})['"]\\s*\\{[\\s\\S]*?^\\}`,
      'gm',
    )
    const collected = new Set<string>()

    for (const file of walk(distRoot)) {
      const isRootEntry =
        file === path.join(distRoot, 'index.d.cts') ||
        file === path.join(distRoot, 'index.d.mts')
      let content = readFileSync(file, 'utf-8')

      content = content.replaceAll(
        /declare module ["']\.\.\/core\/client["']/g,
        `declare module '${PKG.name}'`,
      )

      if (!isRootEntry) {
        const matches = content.match(augmentPattern)
        if (matches?.length) {
          matches.forEach((m) => collected.add(m.trim()))
          content = content
            .replaceAll(augmentPattern, '')
            .replaceAll(/\n{3,}/g, '\n\n')
        }
      }

      writeFileSync(file, content)
    }

    if (collected.size === 0) return

    for (const root of ['index.d.cts', 'index.d.mts']) {
      const file = path.join(distRoot, root)
      const content = readFileSync(file, 'utf-8')
      const block = [
        '',
        '// --- HTTPClient augmentations (inlined) ---',
        ...collected,
      ].join('\n')
      writeFileSync(file, content.trimEnd() + '\n' + block + '\n')
    }
  },
})
