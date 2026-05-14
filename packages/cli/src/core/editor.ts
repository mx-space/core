import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { MxsError } from './errors'

export interface EditorOptions {
  filename: string
  initialContent: string
  editor?: string
}

export async function runEditorRoundTrip(opts: EditorOptions): Promise<string> {
  const editor = opts.editor ?? process.env.EDITOR ?? process.env.VISUAL
  if (!editor) {
    throw new MxsError({
      code: 'generic',
      message: '$EDITOR not set',
      hint: 'export EDITOR=vim (or another editor) and try again',
    })
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-'))
  const tmpPath = path.join(dir, opts.filename)
  await fs.writeFile(tmpPath, opts.initialContent, 'utf8')
  await spawnInteractive(editor, [tmpPath])
  const next = await fs.readFile(tmpPath, 'utf8')
  await fs.unlink(tmpPath).catch(() => undefined)
  await fs.rmdir(dir).catch(() => undefined)
  return next
}

function spawnInteractive(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else
        reject(
          new MxsError({
            code: 'generic',
            message: `editor exited with code ${code}`,
          }),
        )
    })
  })
}
