import cdp, { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { $ } from './shell.util'

export async function getFolderSize(folderPath: string) {
  try {
    return (
      (
        await promisify(exec)(`du -shc ${folderPath} | head -n 1 | cut -f1`, {
          encoding: 'utf-8',
        })
      ).stdout.split('\t')[0] || 'N/A'
    )
  } catch {
    return 'N/A'
  }
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export const formatByteSize = (byteSize: number) => {
  let value = byteSize
  let unitIndex = 0
  while (value > 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }
  return unitIndex === 0
    ? `${value} ${BYTE_UNITS[unitIndex]}`
    : `${value.toFixed(2)} ${BYTE_UNITS[unitIndex]}`
}

export type PackageManager = 'pnpm' | 'yarn' | 'npm'

const LOCKS: Record<string, PackageManager> = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'package-lock.json': 'npm',
}

const INSTALL_COMMANDS: Record<PackageManager, string> = {
  pnpm: 'install',
  yarn: 'add',
  npm: 'install',
}

const SAFE_PKG_NAME = /^[\w@][\w./-]*(?:@[\w*.<=>^~-]+)?$/

export const installPKG = async (name: string, cwd: string) => {
  for (const segment of name.split(/\s+/)) {
    if (!SAFE_PKG_NAME.test(segment)) {
      throw new Error(`Invalid package name: ${segment}`)
    }
  }
  let manager: PackageManager | null = null
  for (const lock of Object.keys(LOCKS)) {
    const isExist = existsSync(path.join(cwd, lock))
    if (isExist) {
      manager = LOCKS[lock]
      break
    }
  }

  if (!manager) {
    for (const managerName of Object.values(LOCKS)) {
      const res = await $(`${managerName} --version`)
      if (res.exitCode === 0) {
        manager = managerName
        break
      }
    }
  }
  if (!manager) {
    // fallback to npm
    const npmVersion = await $('npm -v')
    if (npmVersion.exitCode === 0) {
      manager = 'npm'
    } else {
      throw new Error('No package manager found')
    }
  }
  const names = name.split(/\s+/).filter(Boolean)
  const pty = spawnShell(manager, [INSTALL_COMMANDS[manager], ...names], {
    cwd,
  })

  return pty
}
const noop = () => {}

export const safeProcessEnv = () => {
  const safeKeys = [
    '_',
    'PATH',
    'HOME',
    'SHELL',
    'TMPDIR',
    'PWD',
    'EDITOR',
    'VISUAL',
    'LANG',
    'LESS',
    'N_PREFIX',
    'N_PRESERVE_NPM',
    'STARSHIP_SHELL',
    'PNPM_HOME',
    'COLORTERM',
    'TZ',
  ]
  const env: Record<string, string> = {}
  for (const key of safeKeys) {
    const value = process.env[key]
    if (value) {
      env[key] = value
    }
  }
  return env
}
export const spawnShell = (
  cmd: string,
  args?: string[],
  options?: cdp.SpawnOptionsWithoutStdio,
) => {
  type DataHandler = (string: string, code: 0 | 1) => any
  type ExitHandler = (e: { exitCode: number }) => any

  let onDataHandler: DataHandler = noop
  let onExitHandler: ExitHandler = noop
  const returnObject = {
    onData(callback: DataHandler) {
      onDataHandler = callback
    },
    onExit(callback: ExitHandler) {
      onExitHandler = callback
    },
  }

  const child = cdp.spawn(cmd, args, {
    env: {
      ...safeProcessEnv(),
      FORCE_COLOR: '1',
      ...options?.env,
    },
    ...options,
  })

  child.stdout.on('data', (data) => {
    onDataHandler(data.toString(), 0)
  })

  child.stderr.on('data', (data) => {
    onDataHandler(data.toString(), 1)
  })

  child.on('close', (code) => {
    onExitHandler({ exitCode: code || 0 })
  })

  return returnObject
}
