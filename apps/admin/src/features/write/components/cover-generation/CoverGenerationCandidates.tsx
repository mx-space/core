import { Check } from 'lucide-react'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import type { CoverCandidate } from './use-cover-generation'

export function CoverGenerationCandidates(props: {
  candidates: CoverCandidate[]
  currentCover: string
  onSelect: (url: string) => void
}) {
  const { t } = useI18n()

  if (props.candidates.length === 0) {
    return (
      <p className="text-xs leading-5 text-fg-subtle">
        {t('write.coverGeneration.candidates.empty')}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {props.candidates.map((candidate) => {
        const selected = candidate.url === props.currentCover
        return (
          <button
            aria-pressed={selected}
            className={cn(
              'group relative overflow-hidden rounded-md border bg-surface-inset outline-hidden transition-colors',
              'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
              selected
                ? 'border-accent'
                : 'border-border hover:border-border-strong',
            )}
            key={candidate.taskId}
            onClick={() => props.onSelect(candidate.url)}
            title={candidate.prompt}
            type="button"
          >
            <img
              alt={candidate.prompt}
              className="aspect-video w-full object-cover"
              src={candidate.url}
            />
            {selected ? (
              <span className="shadow-xs absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-white">
                <Check aria-hidden="true" className="size-3" />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
