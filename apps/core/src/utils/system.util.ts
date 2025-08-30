import cdp, { exec } from 'node:child_process'
import { builtinModules } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { $, cd, fs } from '@mx-space/compiled'

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

export const formatByteSize = (byteSize: number) => {
  let size: string
  if (byteSize > 1024 * 1024 * 1024) {
    size = `${(byteSize / 1024 / 1024 / 1024).toFixed(2)} GB`
  } else if (byteSize > 1024 * 1024) {
    size = `${(byteSize / 1024 / 1024).toFixed(2)} MB`
  } else if (byteSize > 1024) {
    size = `${(byteSize / 1024).toFixed(2)} KB`
  } else {
    size = `${byteSize} B`
  }
  return size
}

export const isBuiltinModule = (module: string, ignoreList: string[] = []) => {
  return (
    // @ts-ignore
    // eslint-disable-next-line node/no-deprecated-api
    (builtinModules || (Object.keys(process.binding('natives')) as string[]))
      .filter(
        (x) =>
          !/^_|^(?:internal|v8|node-inspect)\/|\//.test(x) &&
          !ignoreList.includes(x),
      )
      .includes(module)
  )
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

export const installPKG = async (name: string, cwd: string) => {
  let manager: PackageManager | null = null
  for (const lock of Object.keys(LOCKS)) {
    const isExist = await fs.pathExists(path.join(cwd, lock))
    if (isExist) {
      manager = LOCKS[lock]
      break
    }
  }

  if (!manager) {
    for (const managerName of Object.values(LOCKS)) {
      const res = await $`${managerName} --version`.nothrow()
      if (res.exitCode === 0) {
        manager = managerName
        break
      }
    }
  }
  if (!manager) {
    // fallback to npm
    const npmVersion = await $`npm -v`.nothrow()
    if (npmVersion.exitCode === 0) {
      manager = 'npm'
    } else {
      throw new Error('No package manager found')
    }
  }
  cd(cwd)
  // await $`${manager} ${INSTALL_COMMANDS[manager]} ${name}`
  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
  const pty = spawnShell(
    shell,
    ['-c', `${manager} ${INSTALL_COMMANDS[manager]} ${name}`],
    {},
  )

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
