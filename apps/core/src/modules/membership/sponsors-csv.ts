export interface SponsorCsvRow {
  line: number
  githubId: string | null
  email: string | null
  handle: string | null
  months: number | null
  note: string | null
}

export const SPONSOR_CSV_COLUMNS = [
  'github_id',
  'email',
  'handle',
  'months',
  'note',
] as const

export const SPONSOR_CSV_MAX_ROWS = 1000

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      fields.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      fields.push(field)
      records.push(fields)
      fields = []
      field = ''
    } else field += ch
  }
  if (field !== '' || fields.length > 0) {
    fields.push(field)
    records.push(fields)
  }
  return records.filter((r) => r.some((f) => f.trim() !== ''))
}

const emptyToNull = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed || null
}

export function parseSponsorsCsv(text: string): SponsorCsvRow[] {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ''))
  if (records.length === 0) return []
  const header = records[0].map((h) => h.trim().toLowerCase())
  const index = Object.fromEntries(
    SPONSOR_CSV_COLUMNS.map((c) => [c, header.indexOf(c)]),
  ) as Record<(typeof SPONSOR_CSV_COLUMNS)[number], number>
  if (index.github_id < 0 && index.email < 0 && index.handle < 0) {
    throw new Error(
      `CSV header must contain at least one of: github_id, email, handle`,
    )
  }
  const cell = (record: string[], column: keyof typeof index) =>
    index[column] >= 0 ? emptyToNull(record[index[column]]) : null

  return records.slice(1, SPONSOR_CSV_MAX_ROWS + 1).map((record, i) => {
    const monthsRaw = cell(record, 'months')
    const months = monthsRaw === null ? null : Number.parseInt(monthsRaw, 10)
    return {
      line: i + 2,
      githubId: cell(record, 'github_id'),
      email: cell(record, 'email')?.toLowerCase() ?? null,
      handle: cell(record, 'handle'),
      months:
        months !== null && Number.isSafeInteger(months) && months > 0
          ? Math.min(months, 120)
          : null,
      note: cell(record, 'note'),
    }
  })
}
