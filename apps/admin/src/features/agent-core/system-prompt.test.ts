// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createGeneralScene } from './contracts'
import { buildAgentSystemPrompt } from './system-prompt'
import type { AgentToolDefinition } from './turn-loop'

const tools: AgentToolDefinition[] = [
  {
    kind: 'read',
    manifest: {
      name: 'searchPosts',
      description: 'Search posts by keyword.',
      parameters: {},
    },
  },
  {
    kind: 'draftPatch',
    manifest: {
      name: 'draftPostPatch',
      description: 'Prepare post metadata changes.',
      parameters: {},
    },
    execute: async () => ({ content: 'ok' }),
  },
]

describe('buildAgentSystemPrompt', () => {
  it('includes scene context, tool catalog, and write-safety constraints', () => {
    const prompt = buildAgentSystemPrompt(createGeneralScene(tools))

    expect(prompt).toContain('Runtime scene: general.')
    expect(prompt).toContain('Host: workbench.')
    expect(prompt).toContain('searchPosts [read]')
    expect(prompt).toContain('draftPostPatch [write-after-dry-run]')
    expect(prompt).toContain('No dry-run means no write.')
    expect(prompt).toContain('explicit user approval')
  })
})
