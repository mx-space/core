import {
  parseAllowAnnotations,
  scanContent,
} from '../../../scripts/lint-migrations'

describe('lint-migrations', () => {
  it('flags ALTER TABLE ... DROP COLUMN', () => {
    const sql = 'ALTER TABLE users DROP COLUMN email;'
    const { risks } = scanContent('test.sql', sql)
    expect(risks.map((r) => r.rule)).toContain('no-drop-column')
  })

  it('flags DROP TABLE without IF EXISTS', () => {
    const { risks } = scanContent('test.sql', 'DROP TABLE foo;')
    expect(risks.map((r) => r.rule)).toContain('no-drop-table')
    const ok = scanContent('test.sql', 'DROP TABLE IF EXISTS foo;')
    expect(ok.risks.map((r) => r.rule)).not.toContain('no-drop-table')
  })

  it('flags ADD COLUMN ... NOT NULL without DEFAULT', () => {
    const bad = `ALTER TABLE users ADD COLUMN nickname text NOT NULL;`
    const { risks } = scanContent('test.sql', bad)
    expect(risks.map((r) => r.rule)).toContain('no-bare-not-null-add')

    const good = `ALTER TABLE users ADD COLUMN nickname text NOT NULL DEFAULT '';`
    const okay = scanContent('test.sql', good)
    expect(okay.risks.map((r) => r.rule)).not.toContain('no-bare-not-null-add')
  })

  it('flags RENAME COLUMN', () => {
    const { risks } = scanContent(
      'test.sql',
      'ALTER TABLE users RENAME COLUMN nickname TO display_name;',
    )
    expect(risks.map((r) => r.rule)).toContain('no-rename-column')
  })

  it('flags ALTER COLUMN ... TYPE', () => {
    const { risks } = scanContent(
      'test.sql',
      `ALTER TABLE users ALTER COLUMN counter TYPE bigint;`,
    )
    expect(risks.map((r) => r.rule)).toContain('no-alter-type')
  })

  it('flags CREATE INDEX without CONCURRENTLY', () => {
    const { risks } = scanContent(
      'test.sql',
      `CREATE INDEX users_email_idx ON users (email);`,
    )
    expect(risks.map((r) => r.rule)).toContain('no-bare-create-index')
    const okay = scanContent(
      'test.sql',
      `CREATE INDEX CONCURRENTLY users_email_idx ON users (email);`,
    )
    expect(okay.risks.map((r) => r.rule)).not.toContain('no-bare-create-index')
  })

  it('honors -- migration-lint:allow=<rule> with reason', () => {
    const sql = `-- migration-lint:allow=no-drop-column reason=baseline cutover, no consumers yet
ALTER TABLE users DROP COLUMN email;`
    const { risks, warnings } = scanContent('test.sql', sql)
    expect(risks.map((r) => r.rule)).not.toContain('no-drop-column')
    expect(warnings).toEqual([])
  })

  it('rejects allow= without reason=', () => {
    const sql = `-- migration-lint:allow=no-drop-column
ALTER TABLE users DROP COLUMN email;`
    const { warnings } = scanContent('test.sql', sql)
    expect(warnings.some((w) => w.includes('requires reason'))).toBe(true)
  })

  it('parses allow=* as catch-all', () => {
    const sql = `-- migration-lint:allow=* reason=initial bootstrap, no consumers
DROP TABLE foo;
ALTER TABLE bar DROP COLUMN baz;`
    const { risks } = scanContent('test.sql', sql)
    expect(risks).toEqual([])
  })

  it('parses multiple comma-separated rules in one allow', () => {
    const annotations = parseAllowAnnotations(
      `-- migration-lint:allow=no-drop-column,no-rename-column reason=combined`,
    )
    expect(annotations).toHaveLength(1)
    expect(annotations[0].rules.has('no-drop-column')).toBe(true)
    expect(annotations[0].rules.has('no-rename-column')).toBe(true)
  })
})
