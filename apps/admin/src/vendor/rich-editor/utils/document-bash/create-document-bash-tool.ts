import type { AgentToolConfig, AgentToolResult } from '@haklex/rich-agent-core'
import {
  deserializeMxLitexmlToLexical,
  serializeMxLexicalToLitexml,
} from '@mx-space/editor'
import { Bash, type CommandName, defineCommand } from 'just-bash'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

import { diffDocumentStates } from './diff-document-states'

const DOC_PATH = '/doc.xml'
const OUTLINE_PATH = '/.meta/outline'

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
  tool: AgentToolConfig
}

export type CreateDocumentBashWorkspaceOptions = {
  getEditorState: () => SerializedEditorState | null
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
    bash: Bash
    lastEmittedXml: string
  } | null = null

  const beginRun = () => {
    session = null
  }

  const ensureSession = () => {
    if (session) return session
    const editorState = options.getEditorState()
    if (!editorState) return null
    const xml = serializeMxLexicalToLitexml(editorState, { compact: false })
    const bash = new Bash({
      commands: ALLOWED_COMMANDS,
      cwd: '/',
      customCommands: STUB_COMMANDS.map((name) => stubCommand(name)),
      files: {
        [DOC_PATH]: xml,
        [OUTLINE_PATH]: buildOutline(editorState),
      },
    })
    session = {
      base: editorState,
      bash,
      lastEmittedXml: xml,
    }
    return session
  }

  const projectDocument = async (
    current: NonNullable<typeof session>,
  ): Promise<
    Pick<
      Extract<AgentToolResult, { ok: true }>,
      'operations' | 'operationsMode'
    >
  > => {
    const xml = await current.bash.readFile(DOC_PATH)
    if (xml === current.lastEmittedXml) return {}

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

    if (diff.mintedIds.length > 0) {
      const rewritten = serializeMxLexicalToLitexml(diff.nextState, {
        compact: false,
      })
      await current.bash.writeFile(DOC_PATH, rewritten)
      current.lastEmittedXml = rewritten
    } else {
      current.lastEmittedXml = xml
    }

    return {
      operations: diff.operations,
      operationsMode: 'replace',
    }
  }

  const tool: AgentToolConfig = {
    name: 'bash',
    description: [
      'Execute a command in the virtual document workspace.',
      `The article is ${DOC_PATH} (pretty LiteXML). Outline: ${OUTLINE_PATH}.`,
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

      const current = ensureSession()
      if (!current) {
        return {
          error: {
            error: 'editor_unavailable',
            message: 'Editor is not ready',
          },
          ok: false,
        }
      }

      const execResult = await current.bash.exec(command)
      try {
        const projection = await projectDocument(current)
        return {
          content: formatExec(execResult),
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

  return { beginRun, tool }
}
