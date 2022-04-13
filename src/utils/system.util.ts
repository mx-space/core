import { exec } from 'child_process'
import { builtinModules } from 'module'
import { promisify } from 'util'

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
    (builtinModules || (Object.keys(process.binding('natives')) as string[]))
      .filter(
        (x) =>
          !/^_|^(internal|v8|node-inspect)\/|\//.test(x) &&
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
      const res = await nothrow($`${managerName} --version`)
      if (res.exitCode === 0) {
        manager = managerName
        break
      }
    }
  }
  if (!manager) {
    throw new Error('No package manager found')
  }
  cd(cwd)
  await $`${manager} ${INSTALL_COMMANDS[manager]} ${name}`
}
