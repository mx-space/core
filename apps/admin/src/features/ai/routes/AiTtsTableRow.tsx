import type { AITtsListRow } from '~/api/ai'
import { SmallBadge } from '~/features/tasks/components/TaskPrimitives'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'

import { formatDateString } from '../utils/ai'

export function AiTtsTableRow(props: {
  articleTitle: string
  deletePending: boolean
  onDelete: () => void
  onRegenerate: () => void
  onToggleSelect: () => void
  regeneratePending: boolean
  row: AITtsListRow
  selected: boolean
}) {
  const { t } = useI18n()
  const { row } = props

  return (
    <tr>
      <td className="px-4 py-3 align-top">
        <Checkbox
          aria-label={t('ai.tts.selectRowLabel')}
          checked={props.selected}
          onCheckedChange={props.onToggleSelect}
        />
      </td>
      <td className="max-w-xs truncate px-4 py-3 align-top text-fg">
        {props.articleTitle}
      </td>
      <td className="px-4 py-3 align-top">
        <SmallBadge tone="info">{row.lang}</SmallBadge>
      </td>
      <td className="px-4 py-3 align-top tabular-nums text-fg">
        {row.blockCount}
      </td>
      <td className="px-4 py-3 align-top tabular-nums text-fg">
        {row.charCount}
      </td>
      <td className="px-4 py-3 align-top text-fg-muted">
        {formatDateString(row.updatedAt ?? undefined)}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex justify-end gap-2">
          <Button
            disabled={props.regeneratePending}
            onClick={props.onRegenerate}
            type="button"
            variant="subtle"
          >
            {t('ai.action.regenerate')}
          </Button>
          <Button
            className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
            disabled={props.deletePending}
            onClick={props.onDelete}
            type="button"
            variant="subtle"
          >
            {t('ai.action.delete')}
          </Button>
        </div>
      </td>
    </tr>
  )
}
