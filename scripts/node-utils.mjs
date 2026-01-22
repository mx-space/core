// @ts-check
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

/**
 * @typedef {{
 *  cmd: string
 *  exitCode: number | null
 *  signal?: NodeJS.Signals | null
 *  stdout?: string
 *  stderr?: string
 * }} ExecResult
 */

/**
 * @param {string} cmd
 * @param {string[]} [args]
 * @param {{
 *  cwd?: string
 *  env?: Record<string, string | undefined>
 *  stdio?: 'inherit' | 'pipe'
 * }} [opts]
 * @returns {Promise<ExecResult>}
 */
export function exec(cmd, args = [], opts = {}) {
  const { cwd, env, stdio = 'inherit' } = opts

  return new Promise((resolve, reject) => {
    /** @type {import('node:child_process').SpawnOptions} */
    const spawnOpts = {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio:
        stdio === 'pipe'
          ? ['ignore', 'pipe', 'pipe']
          : ('inherit'),
    }

    const child = spawn(cmd, args, spawnOpts)

    /** @type {string | undefined} */
    let stdout
    /** @type {string | undefined} */
    let stderr
    if (stdio === 'pipe') {
      stdout = ''
      stderr = ''
      child.stdout?.on('data', (d) => (stdout += d.toString()))
      child.stderr?.on('data', (d) => (stderr += d.toString()))
    }

    child.on('error', (err) => {
      const e = /** @type {any} */ (err)
      e.cmd = [cmd, ...args].join(' ')
      e.exitCode = null
      if (stdout != null) e.stdout = stdout
      if (stderr != null) e.stderr = stderr
      reject(e)
    })

    child.on('close', (code, signal) => {
      /** @type {ExecResult} */
      const result = {
        cmd: [cmd, ...args].join(' '),
        exitCode: code,
        signal,
        stdout,
        stderr,
      }

      if (code === 0) return resolve(result)

      const err = new Error(
        `Command failed: ${result.cmd} (exitCode=${code ?? 'null'})`,
      )
      const e = /** @type {any} */ (err)
      Object.assign(e, result)
      reject(e)
    })
  })
}

/**
 * Like exec(), but returns error object instead of throwing.
 * @param {string} cmd
 * @param {string[]} [args]
 * @param {Parameters<typeof exec>[2]} [opts]
 */
export async function execNothrow(cmd, args = [], opts) {
  try {
    return await exec(cmd, args, opts)
  } catch (e) {
    return /** @type {any} */ (e)
  }
}

export { sleep }

/**
 * Parse a flag value from argv.
 * Supports:
 * - `--name value`
 * - `--name=value`
 * @param {string[]} argv
 * @param {string[]} names e.g. ['--scp_path', '--scpPath']
 * @returns {string | undefined}
 */
export function getArgValue(argv, names) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    for (const n of names) {
      if (a === n) return argv[i + 1]
      if (a.startsWith(`${n}=`)) return a.slice(n.length + 1)
    }
  }
  return undefined
}

/**
 * Minimal color helpers (avoid chalk dependency).
 */
export const color = {
  yellow: (s) => `\u001b[33m${s}\u001b[39m`,
  yellowBright: (s) => `\u001b[93m${s}\u001b[39m`,
  green: (s) => `\u001b[32m${s}\u001b[39m`,
}

