import { Hash } from 'lucide-react'
import type { TopicModel } from '~/models/topic'

import { TopicAvatar } from './TopicAvatar'

export function TopicSummary(props: { topic: TopicModel }) {
  return (
    <section className="mb-6 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-start gap-4">
        <TopicAvatar className="size-14 text-lg" topic={props.topic} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            {props.topic.name}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">
            <Hash aria-hidden="true" className="size-3" />
            {props.topic.slug}
          </p>
          {props.topic.introduce ? (
            <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
              {props.topic.introduce}
            </p>
          ) : null}
          {props.topic.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              {props.topic.description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
