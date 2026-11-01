import type { AgentToolConfig, ChatMessage } from '@haklex/rich-agent-core'
import { load } from 'js-yaml'
import { z } from 'zod'

export const SKILLS_ROOT = '/skills'
export const LOAD_SKILL_TOOL = 'load_skill'

export type AgentSkill = {
  name: string
  description: string
  body: string
  files: Record<string, string>
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

const frontmatterSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
})

function parseSkillEntry(dir: string, raw: string) {
  const match = FRONTMATTER.exec(raw)
  const parsed = frontmatterSchema.safeParse(match ? load(match[1]) : null)
  if (!parsed.success)
    throw new Error(
      `Agent skill ${dir}/SKILL.md needs frontmatter with name and description: ${parsed.error.message}`,
    )
  if (parsed.data.name !== dir)
    throw new Error(
      `Agent skill folder ${dir} must match its SKILL.md name ${parsed.data.name}`,
    )
  return {
    ...parsed.data,
    body: raw.slice(match![0].length).replace(/^\s*\n/, ''),
  }
}

export function parseAgentSkills(
  modules: Record<string, string>,
): AgentSkill[] {
  const byDir = new Map<string, Record<string, string>>()
  for (const [key, content] of Object.entries(modules)) {
    const [dir, ...rest] = key.replace(/^\.\//, '').split('/')
    if (!dir || rest.length === 0) continue
    const files = byDir.get(dir) ?? {}
    files[rest.join('/')] = content
    byDir.set(dir, files)
  }

  return [...byDir]
    .filter(([, files]) => 'SKILL.md' in files)
    .map(([dir, files]) => ({
      ...parseSkillEntry(dir, files['SKILL.md']),
      files: Object.fromEntries(
        Object.entries(files).map(([path, content]) => [
          `${SKILLS_ROOT}/${dir}/${path}`,
          content,
        ]),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function agentSkillFiles(skills: AgentSkill[]): Record<string, string> {
  return Object.assign({}, ...skills.map((skill) => skill.files))
}

export function buildAgentSkillSystemMessages(
  skills: AgentSkill[],
): ChatMessage[] {
  if (skills.length === 0) return []
  const index = skills
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join('\n')
  return [
    {
      role: 'system',
      content: `## Skills\n\nSkills are instructions for specific kinds of work. When the task matches a skill below, call ${LOAD_SKILL_TOOL} with its name before you start, and follow what it says. A skill's other files are read-only under ${SKILLS_ROOT}/<name>/; read them with cat when the skill points you to them.\n\n${index}`,
    },
  ]
}

export function buildLoadSkillTool(skills: AgentSkill[]): AgentToolConfig {
  const byName = new Map(skills.map((skill) => [skill.name, skill]))
  return {
    name: LOAD_SKILL_TOOL,
    description: `Load a skill's instructions by name, from the Skills list in the system prompt. Call it before starting work the skill covers.`,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Skill name' },
      },
      required: ['name'],
    },
    execute: async (params) => {
      const name = (params as { name?: unknown } | null)?.name
      const skill = typeof name === 'string' ? byName.get(name) : undefined
      if (!skill)
        return {
          ok: false,
          error: {
            error: 'unknown_skill',
            message: `No skill named ${String(name)}. Available: ${[...byName.keys()].join(', ')}`,
          },
        }
      const references = Object.keys(skill.files).filter(
        (path) => !path.endsWith('/SKILL.md'),
      )
      const footer = references.length
        ? `\n\n---\nFiles of this skill (read with cat):\n${references.map((path) => `- ${path}`).join('\n')}`
        : ''
      return { ok: true, content: `${skill.body.trimEnd()}${footer}` }
    },
    describeCall: (params) =>
      String((params as { name?: string })?.name ?? LOAD_SKILL_TOOL),
  }
}
