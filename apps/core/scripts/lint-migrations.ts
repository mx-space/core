/**
 * Static lint for drizzle SQL migrations.
 *
 * Enforces expand-contract guidelines so rolling deploys (Dokploy 2 replicas)
 * stay safe. New migrations whose serial number is greater than `BASELINE`
 * must either avoid the dangerous patterns or include a per-rule `allow`
 * annotation with a `reason=`.
 *
 * Usage: `pnpm -C apps/core run lint:migrations`
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface Rule {
  rule: string
  matches: (statement: string) => boolean
  hint: string
}

const HAS_ADD_COLUMN_NOT_NULL = /\badd\s+column\b.+?\bnot\s+null\b/is
const HAS_DEFAULT = /\bdefault\b/i

export const RULES: Rule[] = [
  {
    rule: 'no-drop-column',
    matches: (s) => /\balter\s+table\s.+?\sdrop\s+column\b/is.test(s),
    hint: 'Drop column requires staging across two releases: stop writing the column, then drop it.',
  },
  {
    rule: 'no-drop-table',
    matches: (s) => /\bdrop\s+table\b(?!\s+if\s+exists)/i.test(s),
    hint: 'Use DROP TABLE IF EXISTS, and confirm no consumers reference it.',
  },
  {
    rule: 'no-bare-not-null-add',
    matches: (s) => HAS_ADD_COLUMN_NOT_NULL.test(s) && !HAS_DEFAULT.test(s),
    hint: 'Adding NOT NULL requires a DEFAULT, or split into three steps: add nullable, backfill, then SET NOT NULL.',
  },
  {
    rule: 'no-rename-column',
    matches: (s) => /\brename\s+column\b/i.test(s),
    hint: 'Rename breaks old replicas. Use expand-contract: add new column, dual-write, cut over, then drop old.',
  },
  {
    rule: 'no-alter-type',
    matches: (s) =>
      /\balter\s+column\s+\S+\s+(?:set\s+data\s+)?type\b/i.test(s),
    hint: 'Type change can lock the entire table and break old replicas. Prefer add new column + backfill + cutover.',
  },
  {
    rule: 'no-bare-create-index',
    matches: (s) =>
      /\bcreate\s+(?:unique\s+)?index\b(?!\s+concurrently)/i.test(s),
    hint: 'Large-table index creation should use CREATE INDEX CONCURRENTLY, outside a transaction.',
  },
]

export interface Risk {
  file: string
  line: number
  rule: string
  snippet: string
  hint: string
}

export interface AllowAnnotation {
  rules: Set<string>
  reason: string
  line: number
}

export const ALLOW_RE =
  /--\s*migration-lint:allow=([\w*,-]+)(?:\s+reason=(.+))?$/i

export const BASELINE = 3 // serial number; migrations with idx <= 3 are exempt

export function parseAllowAnnotations(content: string): AllowAnnotation[] {
  const out: AllowAnnotation[] = []
  const lines = content.split(/\r?\n/)
  for (const [i, line] of lines.entries()) {
    const m = line.match(ALLOW_RE)
    if (!m) continue
    const rulesPart = m[1]
    const reason = (m[2] ?? '').trim()
    out.push({
      rules: new Set(rulesPart.split(',').map((r) => r.trim())),
      reason,
      line: i + 1,
    })
  }
  return out
}

export function isAllowed(
  rule: string,
  hitLine: number,
  annotations: AllowAnnotation[],
): AllowAnnotation | null {
  // An annotation applies if it appears on the same line or any line above
  // (within the same migration file).
  for (const a of annotations) {
    if (a.line > hitLine) continue
    if (a.rules.has(rule) || a.rules.has('*')) return a
  }
  return null
}

export function migrationSerial(filename: string): number | null {
  const m = filename.match(/^(\d+)_/)
  return m ? Number(m[1]) : null
}

interface Statement {
  text: string
  startOffset: number
}

function splitStatements(content: string): Statement[] {
  // Drizzle uses `--> statement-breakpoint` between statements. Treat both
  // the breakpoint marker and `;` as terminators.
  const breakpointRe = /-->\s*statement-breakpoint/g
  const replaced = content.replaceAll(breakpointRe, ';')
  const out: Statement[] = []
  let cursor = 0
  for (let i = 0; i < replaced.length; i++) {
    if (replaced[i] === ';') {
      out.push({
        text: replaced.slice(cursor, i),
        startOffset: cursor,
      })
      cursor = i + 1
    }
  }
  if (cursor < replaced.length) {
    out.push({ text: replaced.slice(cursor), startOffset: cursor })
  }
  return out
}

function offsetToLine(content: string, offset: number): number {
  return content.slice(0, offset).split(/\r?\n/).length
}

export function scanContent(
  file: string,
  content: string,
): { risks: Risk[]; warnings: string[] } {
  const risks: Risk[] = []
  const warnings: string[] = []
  const annotations = parseAllowAnnotations(content)

  const lines = content.split(/\r?\n/)
  const statements = splitStatements(content)

  for (const stmt of statements) {
    if (!stmt.text.trim()) continue
    const stmtLine = offsetToLine(content, stmt.startOffset)
    for (const rule of RULES) {
      if (!rule.matches(stmt.text)) continue
      const allow = isAllowed(rule.rule, stmtLine, annotations)
      if (allow) continue
      const snippet =
        lines[stmtLine - 1]?.trim() ?? stmt.text.trim().slice(0, 100)
      risks.push({
        file,
        line: stmtLine,
        rule: rule.rule,
        snippet,
        hint: rule.hint,
      })
    }
  }

  // Allow annotations require a reason
  for (const a of annotations) {
    if (!a.reason) {
      warnings.push(
        `${file}:${a.line} migration-lint:allow= requires reason=<text>`,
      )
    }
  }

  return { risks, warnings }
}

function scanFile(file: string): { risks: Risk[]; warnings: string[] } {
  const content = readFileSync(file, 'utf8')
  return scanContent(file, content)
}

function main() {
  const cwd = process.cwd()
  const dir = path.resolve(cwd, 'src/database/migrations')
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.sql'))
  } catch (err) {
    console.error(`[lint-migrations] cannot read ${dir}:`, err)
    process.exit(1)
  }

  const allRisks: Risk[] = []
  const allWarnings: string[] = []

  for (const f of files.sort()) {
    const serial = migrationSerial(f)
    if (serial !== null && serial <= BASELINE) continue
    const { risks, warnings } = scanFile(path.join(dir, f))
    allRisks.push(...risks)
    allWarnings.push(...warnings)
  }

  if (allWarnings.length) {
    for (const w of allWarnings) {
      console.error(`[lint-migrations] ${w}`)
    }
  }

  if (allRisks.length) {
    console.error(
      `[lint-migrations] ${allRisks.length} risk(s) found in ${files.length} migration file(s):\n`,
    )
    for (const r of allRisks) {
      console.error(`  ${r.file}:${r.line}  [${r.rule}]`)
      console.error(`    ${r.snippet}`)
      console.error(`    hint: ${r.hint}`)
      console.error(
        `    to override: add "-- migration-lint:allow=${r.rule} reason=<why>" above the statement\n`,
      )
    }
    process.exit(1)
  }

  if (allWarnings.length) {
    process.exit(1)
  }

  console.log(
    `[lint-migrations] ok (${files.length} files scanned, baseline=0${BASELINE})`,
  )
}

main()
