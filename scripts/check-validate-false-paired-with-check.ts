/**
 * CI gate: every `validate: false` in apps/core/src MUST be paired with a
 * subsequent `Value.Check(` within 30 source lines. The pi-runtime adapter
 * skips schema validation when `validate: false` is set, so callers post-
 * process the raw model output and MUST manually re-validate via TypeBox
 * `Value.Check` to keep the structured-output contract intact.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const WINDOW = 30
const repoRoot = resolve(import.meta.dirname, '..')
const searchRoot = join(repoRoot, 'apps/core/src')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, out)
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

const violations: string[] = []

for (const file of walk(searchRoot)) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/\bvalidate\s*:\s*false\b/.test(lines[i])) continue
    const windowEnd = Math.min(lines.length, i + WINDOW + 1)
    const slice = lines.slice(i, windowEnd).join('\n')
    if (!/\bValue\.Check\s*\(/.test(slice)) {
      violations.push(
        `${relative(repoRoot, file)}:${i + 1}: \`validate: false\` not paired with Value.Check within ${WINDOW} lines`,
      )
    }
  }
}

if (violations.length > 0) {
  console.error('validate:false / Value.Check pairing violations:')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}
