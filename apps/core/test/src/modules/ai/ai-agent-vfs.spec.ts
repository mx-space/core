import { describe, expect, it } from 'vitest'

import { reconcileFiles, recordFiles } from '~/modules/ai/ai-agent/ai-agent-vfs'

const DOC = '<doc>\n<p id="a">one</p>\n<p id="b">two</p>\n</doc>'

describe('reconcileFiles', () => {
  it('ignores a file the agent has never read', () => {
    const result = reconcileFiles({}, [{ path: '/doc.xml', content: DOC }])

    expect(result.reminder).toBeNull()
    expect(result.known).toEqual({})
    expect(result.paths).toEqual([])
  })

  it('attaches an attachable file in full the first time and records it', () => {
    const result = reconcileFiles({}, [
      { path: '/selection.xml', content: '<p id="b">two</p>', attach: true },
    ])

    expect(result.reminder).toContain('/selection.xml')
    expect(result.reminder).toContain('<p id="b">two</p>')
    expect(result.known['/selection.xml']).toBe('<p id="b">two</p>')
    expect(result.paths).toEqual(['/selection.xml'])
  })

  it('skips an empty attachable file the agent has never seen', () => {
    const result = reconcileFiles({}, [
      { path: '/selection.xml', content: '', attach: true },
    ])

    expect(result.reminder).toBeNull()
  })

  it('injects a unified diff when a read file changed', () => {
    const next = DOC.replace('two', 'TWO')
    const result = reconcileFiles({ '/doc.xml': DOC }, [
      { path: '/doc.xml', content: next },
    ])

    expect(result.reminder).toMatch(/^<system-reminder>/)
    expect(result.reminder).toContain('-<p id="b">two</p>')
    expect(result.reminder).toContain('+<p id="b">TWO</p>')
    expect(result.known['/doc.xml']).toBe(next)
    expect(result.paths).toEqual(['/doc.xml'])
  })

  it('stays silent when a read file is unchanged', () => {
    const result = reconcileFiles({ '/doc.xml': DOC }, [
      { path: '/doc.xml', content: DOC },
    ])

    expect(result.reminder).toBeNull()
    expect(result.known).toEqual({ '/doc.xml': DOC })
  })

  it('diffs an attachable file against its known version after the first time', () => {
    const result = reconcileFiles({ '/selection.xml': '<p id="b">two</p>' }, [
      { path: '/selection.xml', content: '<p id="a">one</p>', attach: true },
    ])

    expect(result.reminder).toContain('-<p id="b">two</p>')
    expect(result.reminder).toContain('+<p id="a">one</p>')
  })
})

describe('recordFiles', () => {
  it('overwrites known versions with what the agent just read or wrote', () => {
    expect(
      recordFiles({ '/doc.xml': 'old', '/x': 'keep' }, [
        { path: '/doc.xml', content: 'new' },
      ]),
    ).toEqual({ '/doc.xml': 'new', '/x': 'keep' })
  })
})
