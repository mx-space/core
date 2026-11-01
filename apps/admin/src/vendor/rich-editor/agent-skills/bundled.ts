import {
  agentSkillFiles,
  buildAgentSkillSystemMessages,
  buildLoadSkillTool,
  parseAgentSkills,
} from './agent-skills'

export const bundledAgentSkills = parseAgentSkills(
  import.meta.glob<string>('./**/*.md', {
    eager: true,
    import: 'default',
    query: '?raw',
  }),
)

export const bundledAgentSkillFiles = agentSkillFiles(bundledAgentSkills)

export const bundledAgentSkillSystemMessages =
  buildAgentSkillSystemMessages(bundledAgentSkills)

export const bundledLoadSkillTool = buildLoadSkillTool(bundledAgentSkills)
