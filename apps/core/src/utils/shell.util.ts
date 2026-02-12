import {
  execSync,
  spawn,
  type ExecSyncOptions,
  type SpawnOptions,
} from 'node:child_process'

export interface ShellResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ShellOptions extends SpawnOptions {
  quiet?: boolean
}

/**
 * Execute a shell command using spawn and return the result
 */
export async function $(
  command: string,
  options?: ShellOptions,
): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      ...options,
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code, signal) => {
      if (signal) {
        const error = new Error(`Process killed by signal: ${signal}`) as any
        error.signal = signal
        reject(error)
        return
      }

      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      })
    })
  })
}

/**
 * Execute a shell command, throw on non-zero exit
 */
export async function $throw(
  command: string,
  options?: ShellOptions,
): Promise<ShellResult> {
  const result = await $(command, options)
  if (result.exitCode !== 0) {
    const error = new Error(
      `Command failed with exit code ${result.exitCode}: ${command}`,
    ) as any
    error.stdout = result.stdout
    error.stderr = result.stderr
    error.exitCode = result.exitCode
    throw error
  }
  return result
}

/**
 * Execute a shell command synchronously
 */
export function $sync(command: string, options?: ExecSyncOptions): string {
  return execSync(command, { encoding: 'utf-8', ...options }) as string
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
