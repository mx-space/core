import { describe, expect, it } from 'vitest'

import { parseSkillFrontmatter } from './snippets'

describe('parseSkillFrontmatter', () => {
  it('returns ok with undefined fields when no frontmatter present', () => {
    const result = parseSkillFrontmatter('# Just a heading\n\nSome content.')
    expect(result).toEqual({
      ok: true,
      name: undefined,
      description: undefined,
      unknownKeys: [],
    })
  })

  it('parses valid frontmatter with name and description', () => {
    const raw = `---\nname: my-skill\ndescription: Does something useful.\n---\n\n# Body\n`
    const result = parseSkillFrontmatter(raw)
    expect(result).toEqual({
      ok: true,
      name: 'my-skill',
      description: 'Does something useful.',
      unknownKeys: [],
    })
  })

  it('returns ok=false for malformed YAML', () => {
    const raw = `---\nname: [unclosed\n---\n`
    const result = parseSkillFrontmatter(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.errorMessage).toBe('string')
      expect(result.errorMessage.length).toBeGreaterThan(0)
    }
  })

  it('returns ok=false when frontmatter is not an object (scalar)', () => {
    const raw = `---\nfoo\n---\n`
    const result = parseSkillFrontmatter(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorMessage).toBe('frontmatter must be a YAML object')
    }
  })

  it('collects unknown keys into unknownKeys with truncated preview', () => {
    const longValue = 'x'.repeat(80)
    const raw = `---\nname: skill-a\ndescription: desc\nextraKey: ${longValue}\n---\n`
    const result = parseSkillFrontmatter(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.unknownKeys).toHaveLength(1)
      expect(result.unknownKeys[0].key).toBe('extraKey')
      expect(result.unknownKeys[0].preview.endsWith('…')).toBe(true)
      expect(result.unknownKeys[0].preview.length).toBeLessThanOrEqual(62)
    }
  })

  it('unknown key with short value has no ellipsis', () => {
    const raw = `---\nname: skill-b\ndescription: d\nfoo: bar\n---\n`
    const result = parseSkillFrontmatter(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.unknownKeys[0].key).toBe('foo')
      expect(result.unknownKeys[0].preview).toBe('"bar"')
    }
  })

  it('handles CRLF line endings', () => {
    const raw = `---\r\nname: crlf-skill\r\ndescription: line endings\r\n---\r\n\r\n# Body\r\n`
    const result = parseSkillFrontmatter(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.name).toBe('crlf-skill')
      expect(result.description).toBe('line endings')
    }
  })
})
