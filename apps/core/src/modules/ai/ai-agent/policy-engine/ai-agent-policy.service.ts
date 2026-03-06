import { Injectable } from '@nestjs/common'

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

function hasRawCredentialPath(command: string) {
  return /\.env|id_rsa|id_ed25519|\.aws\/credentials|\.npmrc|\.git-credentials/i.test(
    command,
  )
}

@Injectable()
export class AIAgentPolicyService {
  isCommandBlocked(command: string) {
    if (isRecursiveDeleteOnProtectedPath(command)) {
      return {
        blocked: true,
        reason: 'Recursive delete on home/root path is blocked',
      }
    }

    if (hasRawCredentialPath(command)) {
      return {
        blocked: true,
        reason: 'Raw credential files are blocked',
      }
    }

    if (isDiskFormattingCommand(command)) {
      return {
        blocked: true,
        reason: 'Disk formatting commands are blocked',
      }
    }

    return { blocked: false }
  }

  isSensitiveReadCommand(command: string) {
    const readVerb = /\b(?:cat|head|tail|sed|awk|grep|less|more)\b/i
    if (!readVerb.test(command)) {
      return false
    }

    return SENSITIVE_READ_PATHS.some((pattern) => pattern.test(command))
  }

  hasUnsafeShellMetaChars(command: string) {
    // Auto-run path only allows direct command invocation without shell control operators.
    return /[\n\r$&();<>\\`|]/.test(command)
  }
}
