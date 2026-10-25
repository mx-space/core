import type {
  AgentOperation,
  AgentToolConfig,
  AgentToolResult,
} from '@haklex/rich-agent-core'
import type { AgentFileSnapshot } from '@mx-space/ai'
import {
  deserializeMxLitexmlToLexical,
  serializeMxLexicalToLitexml,
} from '@mx-space/editor'
import { Bash, type CommandName, defineCommand, InMemoryFs } from 'just-bash'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

import { diffDocumentStates } from './diff-document-states'

const DOC_PATH = '/doc.xml'
const OUTLINE_PATH = '/.meta/outline'
const SELECTION_PATH = '/selection.xml'
const REVIEW_PATH = '/review.xml'
const TRACKED_PATHS = [DOC_PATH, SELECTION_PATH, OUTLINE_PATH, REVIEW_PATH]
const ATTACHED_PATHS = new Set([SELECTION_PATH, REVIEW_PATH])

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
  'Available: cat ls head tail grep rg sed awk diff wc echo printf find tree cut tr sort uniq tee mkdir cp mv rm'

type NodeRecord = SerializedLexicalNode & {
  $?: { blockId?: string }
  children?: SerializedLexicalNode[]
  text?: string
  type?: string
}

export type DocumentBashWorkspace = {
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
}

class TrackingFs extends InMemoryFs {
  touched: Set<string> | null = null

  private async mark(...paths: string[]) {
    const touched = this.touched
    if (!touched) return
    for (const path of paths) {
      touched.add(path)
      try {
        touched.add(await this.realpath(path))
      } catch {
        // A destination that does not exist yet has no real path.
      }
    }
  }

  override async readFile(...args: Parameters<InMemoryFs['readFile']>) {
    await this.mark(args[0])
    return super.readFile(...args)
  }

  override async readFileBytes(
    ...args: Parameters<InMemoryFs['readFileBytes']>
  ) {
    await this.mark(args[0])
    return super.readFileBytes(...args)
  }

  override async readFileBuffer(
    ...args: Parameters<InMemoryFs['readFileBuffer']>
  ) {
    await this.mark(args[0])
    return super.readFileBuffer(...args)
  }

  override async writeFile(...args: Parameters<InMemoryFs['writeFile']>) {
    await this.mark(args[0])
    return super.writeFile(...args)
  }

  override async appendFile(...args: Parameters<InMemoryFs['appendFile']>) {
    await this.mark(args[0])
    return super.appendFile(...args)
  }

  override async cp(...args: Parameters<InMemoryFs['cp']>) {
    await this.mark(args[0], args[1])
    return super.cp(...args)
  }

  override async mv(...args: Parameters<InMemoryFs['mv']>) {
    await this.mark(args[0], args[1])
    return super.mv(...args)
  }
}

function keepUntouchedBlocks(
  view: SerializedEditorState,
  next: SerializedEditorState,
  operations: AgentOperation[],
): SerializedEditorState {
  const changed = new Set(
    operations.flatMap((operation) =>
      operation.op === 'replace' ? [operation.blockId] : [],
    ),
  )
  const original = new Map<string, SerializedLexicalNode>()
  for (const block of view.root.children) {
    const id = (block as NodeRecord).$?.blockId
    if (id) original.set(id, block)
  }
  return {
    ...next,
    root: {
      ...next.root,
      children: next.root.children.map((block) => {
        const id = (block as NodeRecord).$?.blockId
        return id && !changed.has(id) ? (original.get(id) ?? block) : block
      }),
    },
  }
}

function focusOf(operation: AgentOperation | undefined): string | undefined {
  if (!operation) return undefined
  if (operation.op !== 'insert') return operation.blockId
  return (operation.node as NodeRecord).$?.blockId
}

function extractText(node: SerializedLexicalNode): string {
  const record = node as NodeRecord
  if (typeof record.text === 'string') return record.text
  if (Array.isArray(record.children)) {
    return record.children.map((child) => extractText(child)).join('')
  }
  return ''
}

function buildOutline(state: SerializedEditorState): string {
  const root = state.root as NodeRecord
  const children = Array.isArray(root.children) ? root.children : []
  const lines = children.map((node) => {
    const record = node as NodeRecord
    const id = record.$?.blockId ?? '-'
    const type = typeof record.type === 'string' ? record.type : 'unknown'
    const preview = extractText(node)
      .replaceAll(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
    return `${id} ${type} ${preview}`.trim()
  })
  return ['# /doc.xml outline — ids are XML id attributes', ...lines, ''].join(
    '\n',
  )
}

function stubCommand(name: string) {
  return defineCommand(name, async () => ({
    exitCode: 127,
    stderr: `${name} is not available in this workspace.\nEdit /doc.xml with cat, sed, grep, awk, or a heredoc.\n${AVAILABLE}\n`,
    stdout: '',
  }))
}

function formatExec(result: {
  exitCode: number
  stderr: string
  stdout: string
}) {
  const chunks = [result.stdout, result.stderr].filter((part) => part !== '')
  if (chunks.length > 0) return chunks.join('\n')
  return result.exitCode === 0 ? '' : `exit ${result.exitCode}`
}

function resolveCommand(params: unknown): string | null {
  const command = (params as { command?: unknown } | null)?.command
  if (typeof command !== 'string' || command.trim() === '') return null
  return command
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

  const seedFiles = (editorState: SerializedEditorState) => ({
    [DOC_PATH]: serializeMxLexicalToLitexml(editorState, { compact: false }),
    [OUTLINE_PATH]: buildOutline(editorState),
    [SELECTION_PATH]: options.getSelectionXml?.() ?? '',
    [REVIEW_PATH]: options.getReviewXml?.() ?? '',
  })

  const snapshotFiles = (): AgentFileSnapshot[] => {
    // While the run owns its writes, other people's edits stay out of the agent's view until
    // its next turn, so the files it is told about must be its own copy.
    const owned = session?.ownsWrites ? session : null
    const editorState = owned ? owned.view : options.getEditorState()
    if (!editorState) return []
    const files = owned
      ? { ...seedFiles(editorState), [DOC_PATH]: owned.lastEmittedXml }
      : seedFiles(editorState)
    return TRACKED_PATHS.map((path) =>
      ATTACHED_PATHS.has(path)
        ? { attach: true, content: files[path], path }
        : { content: files[path], path },
    )
  }

  // Report the files as the editor now holds them, not the working copy: a
  // write that failed to apply never reached the document, and the next
  // turn's snapshot must match what is recorded here byte for byte.
  const touchedFiles = () =>
    snapshotFiles().filter((file) => lastTouched.has(file.path))

  const ensureSession = async () => {
    if (session) return session
    const editorState = options.getEditorState()
    const base = options.getBaseState?.() ?? editorState
    if (!editorState || !base) return null
    const files = seedFiles(editorState)
    options.onSeed?.()
    const fs = new TrackingFs(files)
    const bash = new Bash({
      commands: ALLOWED_COMMANDS,
      cwd: '/',
      customCommands: STUB_COMMANDS.map((name) => stubCommand(name)),
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

  const projectDocument = async (
    current: NonNullable<typeof session>,
  ): Promise<
    Pick<
      Extract<AgentToolResult, { ok: true }>,
      'operations' | 'operationsMode'
    > & { note?: string }
  > => {
    const xml = await current.bash.readFile(DOC_PATH)
    if (xml === current.lastEmittedXml) return {}

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

    const diff = diffDocumentStates(current.base, parsed)
    if (!diff.ok) {
      throw new Error(diff.message)
    }
    const viewDiff = diffDocumentStates(current.view, parsed)
    const unchangedFromView = viewDiff.ok && viewDiff.operations.length === 0

    if (diff.mintedIds.length > 0) {
      const rewritten = serializeMxLexicalToLitexml(diff.nextState, {
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
          note: `${DOC_PATH} changed textually but parses to the same document; no edit was recorded.`,
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
      return {}
    }

    if (unchangedFromView && !current.emittedOperations) {
      return {
        note: `${DOC_PATH} changed textually but parses to the same document; no edit was recorded.`,
      }
    }

    current.emittedOperations = true
    return {
      operations: diff.operations,
      operationsMode: 'replace',
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
    execute: async (params): Promise<AgentToolResult> => {
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

      const touched = new Set<string>()
      current.fs.touched = touched
      let execResult: Awaited<ReturnType<Bash['exec']>>
      try {
        execResult = await current.bash.exec(command)
      } finally {
        current.fs.touched = null
      }
      lastTouched = new Set(TRACKED_PATHS.filter((path) => touched.has(path)))
      try {
        const xmlBefore = current.lastEmittedXml
        const { note, ...projection } = await projectDocument(current)
        if (current.lastEmittedXml !== xmlBefore) lastTouched.add(REVIEW_PATH)
        const content = formatExec(execResult)
        return {
          content: note ? `${content}\n${note}`.trim() : content,
          ok: true,
          ...projection,
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

  return { beginRun, snapshotFiles, tool, touchedFiles }
}
