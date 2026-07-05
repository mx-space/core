import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Args, Command, Options } from '@effect/cli'
import { Effect, Option } from 'effect'

import { parseEnvelope } from '../../domain/envelope'
import { Generic, ValidationXml } from '../../domain/errors'
import { Editor } from '../../services/Editor'
import { Renderer } from '../../services/Renderer'
import { registerCommandHelp } from '../help/registry'

registerCommandHelp({
  name: 'preview',
  description:
    'render a LiteXML fragment or <mxpost>/<mxnote> envelope to HTML and open it in a browser',
  isLeaf: true,
  skillChapter: 'commands-preview',
  leafOptions: [
    {
      flag: '--theme <light|dark>',
      description: 'HTML theme; default: light',
    },
    {
      flag: '--variant <article|note|comment>',
      description:
        'HTML variant; auto-detected from envelope root, default: article',
    },
    {
      flag: '--save <path>',
      description: 'write HTML to <path> instead of opening a browser',
    },
    {
      flag: '--print',
      description: 'emit HTML to stdout instead of opening a browser',
    },
    {
      flag: '--open',
      description:
        'explicitly open the rendered HTML in a browser (default behavior)',
    },
  ],
})

const fileArg = Args.text({ name: 'file' }).pipe(Args.optional)
const themeOpt = Options.choice('theme', ['light', 'dark']).pipe(
  Options.optional,
)
const variantOpt = Options.choice('variant', [
  'article',
  'note',
  'comment',
]).pipe(Options.optional)
const saveOpt = Options.text('save').pipe(Options.optional)
const printOpt = Options.boolean('print').pipe(Options.optional)
const openOpt = Options.boolean('open').pipe(Options.optional)

const requireFrom = createRequire(import.meta.url)

const findCliPackageRoot = (): string | null => {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 8; i++) {
    if (!dir || dir === dirname(dir)) break
    try {
      const pkg = requireFrom(join(dir, 'package.json')) as {
        name?: string
      }
      if (pkg.name === '@mx-space/cli') return dir
    } catch {
      // keep walking
    }
    dir = dirname(dir)
  }
  return null
}

const resolveBundledLitexmlBin = (): string | null => {
  const root = findCliPackageRoot()
  if (!root) return null
  const candidate = join(root, 'dist', 'vendor', 'litexml', 'cli.mjs')
  return existsSync(candidate) ? candidate : null
}

const isSourcePreviewModule = (): boolean =>
  /[\\/]src[\\/]cli[\\/]preview[\\/]index\.ts$/.test(
    fileURLToPath(import.meta.url),
  )

const resolveLitexmlBin = (): string => {
  const bundled = resolveBundledLitexmlBin()
  if (!isSourcePreviewModule() && bundled) return bundled

  try {
    return requireFrom.resolve('@haklex/rich-litexml-cli/dist/cli.mjs')
  } catch {
    // Older releases hide subpath imports behind exports; fall through to a
    // best-effort scan of node_modules alongside the cli package.
  }
  const here = import.meta.url
  const filePath = here.startsWith('file://') ? here.slice(7) : here
  let dir = filePath.slice(0, Math.max(0, filePath.lastIndexOf('/')))
  for (let i = 0; i < 8; i++) {
    const candidate = `${dir}/node_modules/@haklex/rich-litexml-cli/dist/cli.mjs`
    if (existsSync(candidate)) return candidate
    const next = dir.slice(0, Math.max(0, dir.lastIndexOf('/')))
    if (next === dir) break
    dir = next
  }
  if (bundled) return bundled
  throw new Generic({
    message: 'cannot resolve LiteXML preview renderer',
    hint: 'rebuild @mx-space/cli or reinstall mxs so the vendored preview renderer is present',
  })
}

const detectVariant = (
  body: string,
): { contentXml: string; variant: 'article' | 'note' } => {
  const trimmed = body.trimStart()
  if (trimmed.startsWith('<mxpost')) {
    const parsed = parseEnvelope(trimmed, 'post')
    return { contentXml: parsed.contentXml, variant: 'article' }
  }
  if (trimmed.startsWith('<mxnote')) {
    const parsed = parseEnvelope(trimmed, 'note')
    return { contentXml: parsed.contentXml, variant: 'note' }
  }
  return { contentXml: body, variant: 'article' }
}

const spawnLitexml = (
  bin: string,
  input: string,
  args: readonly string[],
  capture: boolean,
): Effect.Effect<string, Generic> =>
  Effect.tryPromise({
    try: () =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, [bin, '-', ...args], {
          stdio: capture
            ? ['pipe', 'pipe', 'inherit']
            : ['pipe', 'inherit', 'inherit'],
        })
        const out: Buffer[] = []
        if (capture && child.stdout) {
          child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
        }
        child.on('error', reject)
        child.on('exit', (code) => {
          if (code === 0) {
            resolve(capture ? Buffer.concat(out).toString('utf8') : '')
          } else {
            reject(new Error(`litexml exited with code ${code}`))
          }
        })
        if (!child.stdin) {
          reject(new Error('failed to open litexml stdin'))
          return
        }
        child.stdin.write(input)
        child.stdin.end()
      }),
    catch: (err) =>
      new Generic({
        message: err instanceof Error ? err.message : String(err),
        cause: err,
      }),
  })

export const previewCmd = Command.make(
  'preview',
  {
    file: fileArg,
    theme: themeOpt,
    variant: variantOpt,
    save: saveOpt,
    print: printOpt,
    open: openOpt,
  },
  ({ file, theme, variant, save, print, open: openFlag }) =>
    Effect.gen(function* () {
      const editor = yield* Editor
      const renderer = yield* Renderer

      const filePath = Option.getOrUndefined(file)
      const stdinIsTty = Boolean(process.stdin.isTTY)
      const wantsStdin =
        filePath === undefined || filePath === '-' || filePath === ''
      if (wantsStdin && stdinIsTty) {
        return yield* Effect.fail(
          new ValidationXml({
            message:
              'mxs preview requires a file path or piped LiteXML on stdin',
            hint: 'pass `mxs preview <file>` or pipe content: `cat post.xml | mxs preview -`',
          }),
        )
      }
      const raw = yield* editor.readFileOrStdin(filePath)

      let body: string
      let detectedVariant: 'article' | 'note' = 'article'
      try {
        const det = detectVariant(raw)
        body = det.contentXml
        detectedVariant = det.variant
      } catch (err) {
        return yield* Effect.fail(
          err instanceof ValidationXml
            ? err
            : new ValidationXml({
                message: err instanceof Error ? err.message : String(err),
              }),
        )
      }

      // Wrap content in `<doc>` so haklex's deserializer recognises the root
      // as a block container and strips whitespace between block-level nodes.
      // Without this, the litexml preview client hydrates a Lexical state with
      // stray whitespace text nodes as direct children of root, which Lexical
      // rejects with error #282 ("invalid child of RootNode").
      if (!body.includes('<doc')) {
        body = `<doc>${body}</doc>`
      }

      const resolvedVariant = Option.getOrElse(variant, () => detectedVariant)
      const resolvedTheme = Option.getOrUndefined(theme)
      const savePath = Option.getOrUndefined(save)
      const printMode = Option.getOrElse(print, () => false)
      const explicitOpen = Option.getOrElse(openFlag, () => false)

      if (printMode && savePath) {
        return yield* Effect.fail(
          new ValidationXml({
            message: '--print and --save are mutually exclusive',
          }),
        )
      }
      if (explicitOpen && (printMode || savePath)) {
        return yield* Effect.fail(
          new ValidationXml({
            message: '--open conflicts with --print / --save',
          }),
        )
      }

      const args: string[] = ['--format', 'html', '--variant', resolvedVariant]
      if (resolvedTheme) args.push('--theme', resolvedTheme)
      if (savePath) args.push('-o', savePath)
      else if (!printMode) args.push('--open')

      const bin = resolveLitexmlBin()
      const html = yield* spawnLitexml(bin, body, args, printMode)

      if (printMode) {
        process.stdout.write(html.endsWith('\n') ? html : `${html}\n`)
      } else if (savePath) {
        yield* renderer.emitInfo(`wrote HTML preview to ${savePath}`)
      } else {
        yield* renderer.emitInfo(
          `opened HTML preview (variant=${resolvedVariant})`,
        )
      }
    }),
)
