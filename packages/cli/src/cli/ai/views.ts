import type { AiTaskFinalView } from '../../services/Ai'
import type { View } from '../../services/Renderer/view'

const formatField = (key: string, value: unknown): string =>
  `  ${key.padEnd(15)}${value === undefined || value === null || value === '' ? '-' : String(value)}`

const formatCost = (cost: number | undefined): string | undefined => {
  if (cost === undefined) return undefined
  // Core stores totalCost as cents; show as `<x.xx> ¢`.
  return `${cost.toFixed(2)} ¢`
}

const formatList = (
  values: ReadonlyArray<string> | undefined,
): string | undefined =>
  values && values.length ? values.join(', ') : undefined

export const aiTaskView: View<AiTaskFinalView> = {
  kind: 'ai-task',
  modes: new Set(['readable', 'llm']),
  readable: (data) => {
    const lines = [`ai ${data.type} task ${data.status}`]
    const fields: Array<[string, unknown]> = [
      ['taskId', data.taskId],
      ['refId', data.refId],
      ['targetLanguages', formatList(data.targetLanguages)],
      ['totalTokens', data.totalTokens],
      ['totalCost', formatCost(data.totalCost)],
      ['resultIds', formatList(data.resultIds)],
    ]
    for (const [k, v] of fields) {
      if (v === undefined || v === null || v === '') continue
      lines.push(formatField(k, v))
    }
    if (data.error?.message) {
      lines.push(formatField('error', data.error.message))
    }
    return lines.join('\n')
  },
  llm: (data) =>
    [
      `${data.status}`,
      `type=${data.type}`,
      `taskId=${data.taskId}`,
      data.refId ? `refId=${data.refId}` : null,
      data.totalTokens !== undefined ? `tokens=${data.totalTokens}` : null,
      data.totalCost !== undefined
        ? `cost=${data.totalCost.toFixed(2)}c`
        : null,
      data.error?.message ? `error=${data.error.message}` : null,
    ]
      .filter((s): s is string => s !== null)
      .join(' '),
}
