import { describe, expect, it } from 'vitest'

import {
  buildAgentSkillSystemMessages,
  buildLoadSkillTool,
  parseAgentSkills,
} from './agent-skills'
import { bundledAgentSkills } from './bundled'

const chartSkill = `---
name: chart
description: Draw charts that read at a glance.
---

# Chart

Use one accent color.
`

const modules = {
  './chart/SKILL.md': chartSkill,
  './chart/references/color.md': '# Color\n',
}

describe('parseAgentSkills', () => {
  it('reads name, description and body from SKILL.md frontmatter', () => {
    const [skill] = parseAgentSkills(modules)
    expect(skill.name).toBe('chart')
    expect(skill.description).toBe('Draw charts that read at a glance.')
    expect(skill.body).toBe('# Chart\n\nUse one accent color.\n')
  })

  it('places every file of a skill under /skills/<name>/', () => {
    const [skill] = parseAgentSkills(modules)
    expect(skill.files).toEqual({
      '/skills/chart/SKILL.md': chartSkill,
      '/skills/chart/references/color.md': '# Color\n',
    })
  })

  it('rejects a SKILL.md whose name differs from its folder', () => {
    expect(() => parseAgentSkills({ './charts/SKILL.md': chartSkill })).toThrow(
      /charts/,
    )
  })

  it('rejects a SKILL.md without a description', () => {
    expect(() =>
      parseAgentSkills({ './chart/SKILL.md': '---\nname: chart\n---\nBody\n' }),
    ).toThrow(/description/)
  })
})

describe('buildLoadSkillTool', () => {
  it('returns the body and lists the files to read with cat', async () => {
    const tool = buildLoadSkillTool(parseAgentSkills(modules))
    const result = await tool.execute({ name: 'chart' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).toContain('Use one accent color.')
    expect(result.content).not.toContain('description: Draw charts')
    expect(result.content).toContain('/skills/chart/references/color.md')
  })

  it('names the available skills when the name is unknown', async () => {
    const tool = buildLoadSkillTool(parseAgentSkills(modules))
    const result = await tool.execute({ name: 'nope' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toContain('chart')
  })
})

describe('buildAgentSkillSystemMessages', () => {
  it('indexes each skill by name and description', () => {
    const [message] = buildAgentSkillSystemMessages(parseAgentSkills(modules))
    if (message.role !== 'system') throw new Error('expected a system message')
    expect(message.content).toContain('load_skill')
    expect(message.content).toContain(
      '- chart: Draw charts that read at a glance.',
    )
  })

  it('adds nothing when there are no skills', () => {
    expect(buildAgentSkillSystemMessages([])).toEqual([])
  })
})

describe('bundledAgentSkills', () => {
  it('ships the Excalidraw editing skill', () => {
    expect(bundledAgentSkills.map((skill) => skill.name)).toContain(
      'excalidraw-editing',
    )
  })

  it('teaches the whiteboard-only elements', () => {
    const skill = bundledAgentSkills.find(
      (item) => item.name === 'excalidraw-editing',
    )!
    for (const term of [
      /"shadow": true/,
      /"type": ?"svg"/,
      /"type": ?"richtext"/,
    ]) {
      expect(skill.body).toMatch(term)
    }
  })

  it('teaches dynamic components through /embeds files, not the old tools', () => {
    const skill = bundledAgentSkills.find(
      (item) => item.name === 'dynamic-component-design',
    )!
    expect(skill.description).not.toContain('preview_dynamic_component')
    expect(skill.body).toContain('/embeds/')
    expect(skill.body).toContain('.meta.json')
    expect(skill.body).not.toContain('preview_dynamic_component')
  })

  it('ships the dynamic component design skill', () => {
    expect(bundledAgentSkills.map((skill) => skill.name)).toContain(
      'dynamic-component-design',
    )
  })
})
