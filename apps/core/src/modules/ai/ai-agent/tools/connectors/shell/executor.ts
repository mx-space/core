import { spawn } from 'node:child_process'
import { Type, type Static } from '@mariozechner/pi-ai'
import type { AIAgentToolResult } from '../../../ai-agent.types'

const SHELL_TIMEOUT_MS = 15_000
const MAX_TOOL_OUTPUT_LENGTH = 16_000

export const SHELL_COMMAND_WHITELIST = [
  'pwd',
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'du',
  'df',
  'ps',
  'date',
  'uname',
  'whoami',
  'echo',
  'rg',
  'find',
] as const

export const ShellToolParameters = Type.Object({
  command: Type.String({ minLength: 1 }),
  cwd: Type.Optional(Type.String()),
})

export type ShellToolArgs = Static<typeof ShellToolParameters>

export function parseShellCommandName(command: string) {
  const matched = command.trim().match(/^([\w.-]+)/)
  return matched?.[1]?.toLowerCase() || ''
}

export function isWhitelistedShellCommand(command: string) {
  const name = parseShellCommandName(command)
  return SHELL_COMMAND_WHITELIST.includes(name as any)
}

interface ExecuteShellToolContext {
  sessionId: string
  seq: { value: number }
  params: ShellToolArgs
  safeJson: (input: unknown) => string
  createPendingAction: (
    sessionId: string,
    seq: { value: number },
    toolName: string,
    args: Record<string, unknown>,
    dryRunPreview: Record<string, unknown>,
  ) => Promise<{ id: string }>
}

export async function executeShellTool(
  context: ExecuteShellToolContext,
): Promise<AIAgentToolResult> {
  if (isWhitelistedShellCommand(context.params.command)) {
    const result = await executeShellCommand(
      context.params.command,
      context.params.cwd,
    )
    return {
      content: [
        {
          type: 'text' as const,
          text: context.safeJson(result),
        },
      ],
      details: {
        command: context.params.command,
        commandName: parseShellCommandName(context.params.command),
        result,
      },
    }
  }

  const dryRunPreview = {
    command: context.params.command,
    cwd: context.params.cwd,
    reason: 'Command is not in hardcoded whitelist',
    commandName: parseShellCommandName(context.params.command),
  }

  const action = await context.createPendingAction(
    context.sessionId,
    context.seq,
    'shell',
    {
      ...context.params,
    },
    dryRunPreview,
  )

  return {
    content: [
      {
        type: 'text' as const,
        text: `Shell command requires confirmation. actionId=${action.id}`,
      },
    ],
    details: {
      pendingConfirmation: true,
      actionId: action.id,
      dryRunPreview,
    },
  }
}

export async function executeShellConfirmedAction(
  params: Record<string, unknown>,
) {
  const command = params.command as string | undefined
  const cwd = params.cwd as string | undefined

  if (!command) {
    throw new Error('Invalid shell action payload: missing command')
  }

  return executeShellCommand(command, cwd)
}

export async function executeShellCommand(command: string, cwd?: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawn('sh', ['-lc', command], {
      cwd: cwd || process.cwd(),
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, SHELL_TIMEOUT_MS)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (stdout.length > MAX_TOOL_OUTPUT_LENGTH) {
        stdout = stdout.slice(0, MAX_TOOL_OUTPUT_LENGTH)
      }
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > MAX_TOOL_OUTPUT_LENGTH) {
        stderr = stderr.slice(0, MAX_TOOL_OUTPUT_LENGTH)
      }
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      resolve({
        command,
        cwd: cwd || process.cwd(),
        exitCode: exitCode ?? 0,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      })
    })
  })
}
