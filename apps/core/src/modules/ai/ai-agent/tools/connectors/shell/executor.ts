import { spawn } from 'node:child_process'

import { type Static, Type } from '@mariozechner/pi-ai'

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

const SENSITIVE_READ_PATHS = [
  /\.env/i,
  /id_rsa|id_ed25519|id_ecdsa/i,
  /\.aws\/credentials/i,
  /\.docker\/config\.json/i,
  /\.kube\/config/i,
  /\.git-credentials/i,
  /\.npmrc/i,
  /\.(bash_history|zsh_history|history)/i,
]

function hasUnsafeShellMetaChars(command: string) {
  // Auto-run path only allows direct command invocation without shell control operators.
  return /[\n\r$&();<>\\`|]/.test(command)
}

function isSensitiveReadCommand(command: string) {
  const readVerb = /\b(?:cat|head|tail|sed|awk|grep|less|more)\b/i
  if (!readVerb.test(command)) {
    return false
  }

  return SENSITIVE_READ_PATHS.some((pattern) => pattern.test(command))
}

function tokenizeCommand(command: string) {
  return command.trim().split(/\s+/).filter(Boolean)
}

function stripWrappingQuotes(value: string) {
  return value.replaceAll(/^["']+|["']+$/g, '')
}

function isProtectedDeleteTarget(target: string) {
  const normalized = stripWrappingQuotes(target.trim()).replaceAll(/\/+$/g, '')
  if (!normalized || normalized === '/') {
    return true
  }

  if (normalized === '~' || normalized === '$HOME') {
    return true
  }

  if (/^\/users\/[^/]+$/i.test(normalized)) {
    return true
  }

  if (/^\/home\/[^/]+$/i.test(normalized)) {
    return true
  }

  return false
}

function isRecursiveDeleteOnProtectedPath(command: string) {
  const tokens = tokenizeCommand(command)
  if (!tokens.length || tokens[0].toLowerCase() !== 'rm') {
    return false
  }

  let hasRecursive = false
  let hasForce = false
  const targets: string[] = []

  for (const token of tokens.slice(1)) {
    if (token.startsWith('-') && token.length > 1) {
      const flags = token.slice(1).toLowerCase()
      if (flags.includes('r')) {
        hasRecursive = true
      }
      if (flags.includes('f')) {
        hasForce = true
      }
      continue
    }

    targets.push(token)
  }

  if (!(hasRecursive && hasForce)) {
    return false
  }

  if (!targets.length) {
    return false
  }

  return targets.some((target) => isProtectedDeleteTarget(target))
}

function isDiskFormattingCommand(command: string) {
  const normalized = command.toLowerCase()
  if (/\bmkfs\b/.test(normalized)) {
    return true
  }
  if (/\bfdisk\b/.test(normalized)) {
    return true
  }
  if (/\bparted\b/.test(normalized)) {
    return true
  }

  if (!/\bdd\b/.test(normalized)) {
    return false
  }

  return normalized.includes('of=/dev/') || normalized.includes(' of /dev/')
}

function getBlockedReason(command: string) {
  if (isRecursiveDeleteOnProtectedPath(command)) {
    return 'Recursive delete on home/root path is blocked'
  }

  if (isDiskFormattingCommand(command)) {
    return 'Disk formatting commands are blocked'
  }

  return null
}

function shouldAutoExecuteCommand(command: string) {
  if (!isWhitelistedShellCommand(command)) {
    return false
  }

  if (hasUnsafeShellMetaChars(command)) {
    return false
  }

  if (isSensitiveReadCommand(command)) {
    return false
  }

  if (getBlockedReason(command)) {
    return false
  }

  return true
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
  const blockedReason = getBlockedReason(context.params.command)
  if (blockedReason) {
    throw new Error(`Command blocked by policy: ${blockedReason}`)
  }

  if (shouldAutoExecuteCommand(context.params.command)) {
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
    reason: 'Unsafe or non-whitelisted command requires confirmation',
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

  const blockedReason = getBlockedReason(command)
  if (blockedReason) {
    throw new Error(`Command blocked by policy: ${blockedReason}`)
  }

  return executeShellCommand(command, cwd)
}

export async function executeShellCommand(command: string, cwd?: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawn('sh', ['-lc', command], {
      cwd: cwd || process.cwd(),
      env: {
        HOME: process.env.HOME,
        LANG: process.env.LANG,
        PATH: process.env.PATH,
        SHELL: process.env.SHELL,
        TERM: process.env.TERM,
      },
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
