import type { IPAggregate } from '~/api/analyze'

import { AnalyzePathsPanel } from './AnalyzePathsPanel'
import { AnalyzeRankPanel } from './AnalyzeRankPanel'

export function AnalyzeContentRow(props: {
  aggregate: IPAggregate | undefined
  isLoading: boolean
  window: { start: number; end: number }
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <AnalyzePathsPanel
        aggregate={props.aggregate}
        isLoading={props.isLoading}
      />
      <AnalyzeRankPanel window={props.window} />
    </div>
  )
}
