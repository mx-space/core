export const defaultServerlessFunction = `
export default async function handler(ctx: Context) {
  return 'pong';
}
`.trimStart()
export enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
  Function = 'function',
  Text = 'text',
  Skill = 'skill',
  YAML = 'yaml',
}

export const SnippetTypeToLanguage: Record<SnippetType, string> = {
  [SnippetType.JSON]: 'json',
  [SnippetType.JSON5]: 'plaintext',
  [SnippetType.Function]: 'typescript',
  [SnippetType.Text]: 'markdown',
  [SnippetType.Skill]: 'markdown',
  [SnippetType.YAML]: 'yaml',
}

export function getSnippetLanguage(path: string, type: SnippetType) {
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.json5')) return 'plaintext'
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml'
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript'
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript'
  if (path.endsWith('.py')) return 'python'
  if (path.endsWith('.md') || path.endsWith('.mdx')) return 'markdown'
  return SnippetTypeToLanguage[type]
}

export class SnippetModel {
  id = ''
  createdAt = ''
  updatedAt: string | null = null

  type = SnippetType.JSON
  private = false
  raw = '{}'
  path = ''
  comment?: string | null
  metatype?: string | null
  schema?: string | null

  // for serverless function
  enable?: boolean
  method?: string | null
  secret?: Record<string, any> | string | null

  builtIn = false
  compiledCode?: string | null
}
