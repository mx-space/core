import type {
  CheckpointKind,
  CrdtOpId,
  DraftChange,
  DraftHistory,
} from '~/models/draft'

export type StepKind = 'agent' | 'human' | 'other' | 'restore' | 'undo'

export interface TimelineStep {
  author: string | null
  before: CrdtOpId[]
  change: CrdtOpId
  count: number
  kind: StepKind
  message: string
  time: number
  type: 'step'
  undoable: boolean
}

export interface TimelineCheckpoint {
  id: string
  kind: CheckpointKind | null
  published: boolean
  time: number
  title: string
  type: 'checkpoint'
}

export type TimelineRow = TimelineCheckpoint | TimelineStep

const HUMAN_IDLE_GAP_SECONDS = 60

const kindOf = (message = ''): StepKind => {
  if (message.startsWith('human')) return 'human'
  if (message.startsWith('agent')) return 'agent'
  if (message.startsWith('restore')) return 'restore'
  if (message.startsWith('undo')) return 'undo'
  return 'other'
}

const authorOf = (message: string) => {
  const match = /^human:(.+)$/.exec(message)
  return match && match[1] !== 'owner' ? match[1] : null
}

const groupSteps = (changes: DraftChange[]): TimelineStep[] => {
  const steps: TimelineStep[] = []
  let oldestInGroup = 0
  let groupPeer = ''
  for (const entry of changes) {
    const kind = kindOf(entry.message)
    const message = entry.message ?? ''
    const last = steps.at(-1)
    const joins =
      last?.kind === kind &&
      last.message === message &&
      ((kind === 'human' &&
        oldestInGroup - entry.timestamp <= HUMAN_IDLE_GAP_SECONDS) ||
        (kind === 'agent' && groupPeer === entry.id.peer))
    if (joins && last) {
      last.count += 1
      last.before = entry.deps
    } else {
      groupPeer = entry.id.peer
      steps.push({
        author: authorOf(message),
        before: entry.deps,
        change: entry.id,
        count: 1,
        kind,
        message,
        time: entry.timestamp * 1000,
        type: 'step',
        undoable: kind === 'human' || kind === 'agent',
      })
    }
    oldestInGroup = entry.timestamp
  }
  return steps
}

export function buildTimeline(
  history: DraftHistory,
  publishedRevisionId: string | null,
): TimelineRow[] {
  const checkpoints: TimelineCheckpoint[] = history.checkpoints.map(
    (checkpoint) => ({
      id: checkpoint.id,
      kind: checkpoint.kind ?? null,
      published: checkpoint.id === publishedRevisionId,
      time: Date.parse(checkpoint.createdAt),
      title: checkpoint.title,
      type: 'checkpoint',
    }),
  )
  // The import change is the import checkpoint itself, already listed as one.
  const changes = history.changes.filter(
    (change) => !change.message?.startsWith('import '),
  )
  return [...checkpoints, ...groupSteps(changes)].sort(
    (left, right) =>
      right.time - left.time ||
      (left.type === right.type ? 0 : left.type === 'checkpoint' ? -1 : 1),
  )
}
