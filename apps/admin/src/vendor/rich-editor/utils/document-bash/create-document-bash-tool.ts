import type { AgentToolConfig, AgentToolResult } from '@haklex/rich-agent-core'
import type { AgentFileSnapshot } from '@mx-space/ai'
import {
  deserializeMxLitexmlToLexical,
  serializeMxLexicalToLitexml,
} from '@mx-space/editor'
import { Bash, type CommandName, defineCommand } from 'just-bash'
import type { SerializedEditorState } from 'lexical'

import { diffDocumentStates } from './diff-document-states'
import { type EmbedMount, EMBEDS_DIR, type EmbedView } from './embed-mount'
import { TrackingFs } from './tracking-fs'
import {
  buildOutline,
  focusOf,
  formatExec,
  keepUntouchedBlocks,
  resolveCommand,
} from './workspace-helpers'

const DOC_PATH = '/doc.xml'
const OUTLINE_PATH = '/.meta/outline'
const SELECTION_PATH = '/selection.xml'
const REVIEW_PATH = '/review.xml'
const TRACKED_PATHS = [DOC_PATH, SELECTION_PATH, OUTLINE_PATH, REVIEW_PATH]
const ATTACHED_PATHS = new Set([SELECTION_PATH, REVIEW_PATH])
// The core ws schema rejects a tool result with more images than this.
const MAX_VIEW_IMAGES = 8

const ALLOWED_COMMANDS: CommandName[] = [
  'awk',
  'basename',
  'cat',
  'cp',
  'cut',
  'diff',
  'dirname',
  'echo',
  'egrep',
  'false',
  'fgrep',
  'find',
  'grep',
  'head',
  'help',
  'ls',
  'mkdir',
  'mv',
  'printf',
  'pwd',
  'rg',
  'rm',
  'sed',
  'sort',
  'tail',
  'tee',
  'touch',
  'tr',
  'tree',
  'true',
  'uniq',
  'wc',
  'which',
]

const STUB_COMMANDS = [
  'python3',
  'python',
  'pip',
  'node',
  'nodejs',
  'perl',
  'ruby',
  'php',
] as const

const AVAILABLE =
  'Available: cat ls head tail grep rg sed awk diff wc echo printf find tree cut tr sort uniq tee mkdir cp mv rm view'

export type DocumentBashToolResult = AgentToolResult & {
  images?: { url: string; mimeType: string }[]
}

export type DocumentBashWorkspace = {
  addEmbedFile: (url: string, name: string) => Promise<string>
  beginRun: () => void
  snapshotFiles: () => AgentFileSnapshot[]
  tool: AgentToolConfig
  touchedFiles: () => AgentFileSnapshot[]
}

export type CreateDocumentBashWorkspaceOptions = {
  applyDocument?: (target: SerializedEditorState, focusBlockId?: string) => void
  ownsWrites?: () => boolean
  onSeed?: () => void
  getEditorState: () => SerializedEditorState | null
  getBaseState?: () => SerializedEditorState | null
  getSelectionXml?: () => string
  getReviewXml?: () => string
  readonlyFiles?: Record<string, string>
  embeds?: EmbedMount
}

function stubCommand(name: string) {
  return defineCommand(name, async () => ({
    exitCode: 127,
    stderr: `${name} is not available in this workspace.\nEdit /doc.xml with cat, sed, grep, awk, or a heredoc.\n${AVAILABLE}\n`,
    stdout: '',
  }))
}

export function createDocumentBashWorkspace(
  options: CreateDocumentBashWorkspaceOptions,
): DocumentBashWorkspace {
  let session: {
    base: SerializedEditorState
    view: SerializedEditorState
    bash: Bash
    emittedOperations: boolean
    fs: TrackingFs
    ownsWrites: boolean
    lastEmittedXml: string
  } | null = null
  let lastTouched = new Set<string>()

  const beginRun = () => {
    session = null
    lastTouched = new Set()
  }

  const viewOf = (
    editorState: SerializedEditorState,
    remember: boolean,
  ): EmbedView =>
    options.embeds?.toView(editorState, { remember }) ?? {
      state: editorState,
      files: {},
      readonly: [],
      versions: {},
    }

  const seedFiles = (view: EmbedView) => ({
    [DOC_PATH]: serializeMxLexicalToLitexml(view.state, { compact: false }),
    [OUTLINE_PATH]: buildOutline(view.state),
    [SELECTION_PATH]: options.getSelectionXml?.() ?? '',
    [REVIEW_PATH]: options.getReviewXml?.() ?? '',
  })

  const snapshotFiles = (): AgentFileSnapshot[] => {
    // While the run owns its writes, other people's edits stay out of the agent's view until
    // its next turn, so the files it is told about must be its own copy.
    const owned = session?.ownsWrites ? session : null
    const editorState = owned ? owned.view : options.getEditorState()
    if (!editorState) return []
    const view = viewOf(editorState, false)
    const files = owned
      ? { ...seedFiles(view), [DOC_PATH]: owned.lastEmittedXml }
      : seedFiles(view)
    return [
      ...TRACKED_PATHS.map((path) =>
        ATTACHED_PATHS.has(path)
          ? { attach: true, content: files[path], path }
          : { content: files[path], path },
      ),
      ...Object.entries(view.versions).map(([path, content]) => ({
        content,
        path,
      })),
    ]
  }

  // Report the files as the editor now holds them, not the working copy: a
  // write that failed to apply never reached the document, and the next
  // turn's snapshot must match what is recorded here byte for byte.
  const touchedFiles = () =>
    snapshotFiles().filter((file) => lastTouched.has(file.path))

  let shownImages: { url: string; mimeType: string }[] = []
  const viewCommand = defineCommand('view', async (args, ctx) => {
    const errors: string[] = []
    const shown: string[] = []
    for (const arg of args) {
      const path = arg.startsWith('/')
        ? arg
        : `${ctx.cwd.replace(/\/$/, '')}/${arg}`
      const image = options.embeds?.imageOf(path)
      if (image && shownImages.length >= MAX_VIEW_IMAGES) {
        errors.push(
          `${path} was not shown: one command shows at most ${MAX_VIEW_IMAGES} images; view the rest in another command.`,
        )
      } else if (image) {
        shownImages.push(image)
        shown.push(`shown ${path}`)
      } else {
        errors.push(
          `${path} is not an image under ${EMBEDS_DIR}; view only shows images.`,
        )
      }
    }
    return {
      exitCode: errors.length ? 1 : 0,
      stderr: errors.map((line) => `${line}\n`).join(''),
      stdout: shown.map((line) => `${line}\n`).join(''),
    }
  })

  const ensureSession = async () => {
    if (session) return session
    const editorState = options.getEditorState()
    const base = options.getBaseState?.() ?? editorState
    if (!editorState || !base) return null
    await options.embeds?.prefetch(editorState)
    const view = viewOf(editorState, true)
    const files = seedFiles(view)
    options.onSeed?.()
    const readonlyFiles = options.readonlyFiles ?? {}
    const lockedFiles = options.embeds?.canUpload()
      ? view.readonly
      : Object.keys(view.files)
    const fs = new TrackingFs(
      { ...files, ...view.files, ...readonlyFiles },
      Object.keys(readonlyFiles),
      lockedFiles,
    )
    const bash = new Bash({
      commands: ALLOWED_COMMANDS,
      cwd: '/',
      customCommands: [
        ...STUB_COMMANDS.map((name) => stubCommand(name)),
        viewCommand,
      ],
      fs,
    })
    await bash.exec('mkdir -p /tmp')
    session = {
      base,
      bash,
      ownsWrites: options.ownsWrites?.() ?? Boolean(options.applyDocument),
      view: editorState,
      emittedOperations: false,
      fs,
      lastEmittedXml: files[DOC_PATH],
    }
    return session
  }

  const readEmbed = async (
    current: NonNullable<typeof session>,
    path: string,
  ) => {
    try {
      return await current.fs.readFile(path, 'utf8')
    } catch {
      return null
    }
  }

  const resolveEmbeds = async (
    current: NonNullable<typeof session>,
    parsed: SerializedEditorState,
  ) => {
    if (!options.embeds) return { state: parsed, rewrite: null, notices: [] }
    const minted = diffDocumentStates(current.base, parsed)
    if (!minted.ok) throw new Error(minted.message)
    const state = await options.embeds.fromView(minted.nextState, (path) =>
      readEmbed(current, path),
    )
    const report = options.embeds.takeReport()
    for (const [path, text] of Object.entries(report.files)) {
      await current.fs.writeFile(path, text)
      lastTouched.add(path)
    }
    return {
      state,
      rewrite:
        report.view ?? (minted.mintedIds.length > 0 ? minted.nextState : null),
      notices: report.notices,
    }
  }

  const projectDocument = async (
    current: NonNullable<typeof session>,
    embedsWritten: boolean,
  ): Promise<
    Pick<
      Extract<AgentToolResult, { ok: true }>,
      'operations' | 'operationsMode'
    > & { note?: string }
  > => {
    const xml = await current.bash.readFile(DOC_PATH)
    if (xml === current.lastEmittedXml && !embedsWritten) return {}

    const rootEnd = xml.lastIndexOf('</doc>')
    if (rootEnd !== -1 && xml.slice(rootEnd + '</doc>'.length).trim()) {
      throw new Error(
        `${DOC_PATH} has content after </doc>, which is outside the document and was not applied. Put new blocks before </doc>, for example: sed -i 's|</doc>|  <p>…</p>\\n</doc>|' ${DOC_PATH}`,
      )
    }

    let parsed: SerializedEditorState
    try {
      parsed = deserializeMxLitexmlToLexical(xml)
    } catch (error) {
      throw new Error(`Failed to parse ${DOC_PATH}`, { cause: error })
    }

    const resolved = await resolveEmbeds(current, parsed)
    const notice = resolved.notices.join('\n') || undefined
    parsed = resolved.state
    const diff = diffDocumentStates(current.base, parsed)
    if (!diff.ok) {
      throw new Error(diff.message)
    }
    const viewDiff = diffDocumentStates(current.view, parsed)
    const unchangedFromView = viewDiff.ok && viewDiff.operations.length === 0

    const rewriteFrom =
      resolved.rewrite ?? (diff.mintedIds.length > 0 ? diff.nextState : null)
    if (rewriteFrom) {
      const rewritten = serializeMxLexicalToLitexml(rewriteFrom, {
        compact: false,
      })
      await current.bash.writeFile(DOC_PATH, rewritten)
      current.lastEmittedXml = rewritten
    } else {
      current.lastEmittedXml = xml
    }
    await current.bash.writeFile(OUTLINE_PATH, buildOutline(diff.nextState))

    if (current.ownsWrites && options.applyDocument) {
      const applied = diffDocumentStates(current.view, diff.nextState)
      if (!applied.ok) throw new Error(applied.message)
      if (applied.operations.length === 0) {
        return {
          note:
            notice ??
            `${DOC_PATH} changed textually but parses to the same document; no edit was recorded.`,
        }
      }
      // LiteXML drops inline style, alignment and indent, so only blocks the agent changed may
      // come from the parsed file; every other block keeps the document's own JSON.
      const target = keepUntouchedBlocks(
        current.view,
        diff.nextState,
        applied.operations,
      )
      options.applyDocument(target, focusOf(applied.operations.at(-1)))
      current.base = target
      current.view = target
      return { note: notice }
    }

    if (unchangedFromView && !current.emittedOperations) {
      return {
        note:
          notice ??
          `${DOC_PATH} changed textually but parses to the same document; no edit was recorded.`,
      }
    }

    current.emittedOperations = true
    return {
      operations: diff.operations,
      operationsMode: 'replace',
      note: notice,
    }
  }

  const tool: AgentToolConfig = {
    name: 'bash',
    description: [
      'Execute a command in the virtual document workspace.',
      `The article is ${DOC_PATH} (pretty LiteXML). Outline: ${OUTLINE_PATH}. User selection: ${SELECTION_PATH}.`,
      'This is not a host shell. No Python or Node.',
      AVAILABLE,
    ].join(' '),
    parameters: {
      additionalProperties: false,
      properties: {
        command: {
          description: 'Shell command to run against the virtual filesystem',
          type: 'string',
        },
      },
      required: ['command'],
      type: 'object',
    },
    describeCall: (params) => {
      const command = resolveCommand(params)
      if (!command) return 'bash'
      return command.length > 60 ? `${command.slice(0, 60)}…` : command
    },
    execute: async (params): Promise<DocumentBashToolResult> => {
      const command = resolveCommand(params)
      if (!command) {
        return {
          error: {
            error: 'invalid_params',
            message: 'command must be a non-empty string',
          },
          ok: false,
        }
      }

      const current = await ensureSession()
      if (!current) {
        return {
          error: {
            error: 'editor_unavailable',
            message: 'Editor is not ready',
          },
          ok: false,
        }
      }

      shownImages = []
      const touched = new Set<string>()
      const refused = new Set<string>()
      const written = new Set<string>()
      current.fs.touched = touched
      current.fs.refused = refused
      current.fs.written = written
      let execResult: { exitCode: number; stderr: string; stdout: string }
      try {
        execResult = await current.bash.exec(command)
      } catch (error) {
        // just-bash lets a failed redirect target escape exec instead of reporting it.
        if (refused.size === 0) throw error
        execResult = { exitCode: 1, stderr: '', stdout: '' }
      } finally {
        current.fs.touched = null
        current.fs.written = null
        current.fs.refused = null
      }
      if (refused.size > 0)
        execResult = {
          ...execResult,
          stderr: `${execResult.stderr}${[...refused].join(', ')}: read-only file system. Copy it to /tmp to work on a copy.\n`,
        }
      const isEmbed = (path: string) => path.startsWith(`${EMBEDS_DIR}/`)
      lastTouched = new Set([
        ...TRACKED_PATHS.filter((path) => touched.has(path)),
        ...[...touched].filter(isEmbed),
      ])
      try {
        const xmlBefore = current.lastEmittedXml
        const { note, ...projection } = await projectDocument(
          current,
          [...written].some(isEmbed),
        )
        if (current.lastEmittedXml !== xmlBefore) lastTouched.add(REVIEW_PATH)
        const content = formatExec(execResult)
        return {
          content: note ? `${content}\n${note}`.trim() : content,
          ok: true,
          ...projection,
          ...(shownImages.length ? { images: shownImages } : {}),
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: `${formatExec(execResult)}\n${message}`.trim(),
          ok: true,
        }
      }
    },
  }

  const addEmbedFile = async (url: string, name: string) => {
    const current = await ensureSession()
    if (!current || !options.embeds) throw new Error('Editor is not ready')
    const { path, content } = options.embeds.registerMedia(url, name)
    await current.fs.writeFile(path, content)
    current.fs.lock(path)
    return path
  }

  return { addEmbedFile, beginRun, snapshotFiles, tool, touchedFiles }
}
