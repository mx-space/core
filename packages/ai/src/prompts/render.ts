export type PromptVars = Record<string, string | number | undefined | null>

// eslint-disable-next-line prefer-regex-literals -- regex literal triggers conflicting regexp/strict + unicorn/better-regex on {{ }}
const PLACEHOLDER_PATTERN = new RegExp('\\{\\{\\s*([A-Z_]\\w*)\\s*\\}\\}', 'gi')

export function renderPromptTemplate(
  template: string,
  vars: PromptVars = {},
): string {
  return template.replaceAll(PLACEHOLDER_PATTERN, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return match
    const value = vars[name]
    if (value === null || value === undefined) return ''
    return String(value)
  })
}
