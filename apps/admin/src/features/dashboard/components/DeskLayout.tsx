import type { ReactNode } from 'react'

import { useMediaQuery } from '~/hooks/use-media-query'
import { AppPage } from '~/ui/layout/page-layout'
import { Scroll } from '~/ui/primitives/scroll'

import { deskSplitMediaQuery } from '../constants'

export function DeskLayout(props: { primary: ReactNode; rail: ReactNode }) {
  const split = useMediaQuery(deskSplitMediaQuery)

  return (
    <AppPage>
      {split ? (
        <div className="flex min-h-0 flex-1">
          <Scroll
            className="min-h-0 min-w-0 flex-1 bg-background"
            innerClassName="flex min-h-full flex-col px-16 pb-10 pt-12"
          >
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
              {props.primary}
            </div>
          </Scroll>
          <Scroll
            className="min-h-0 w-[300px] shrink-0 border-l border-border bg-background"
            innerClassName="px-7 pb-6 pt-6"
          >
            <aside>{props.rail}</aside>
          </Scroll>
        </div>
      ) : (
        <Scroll
          className="min-h-0 flex-1 bg-background"
          innerClassName="@container/desk flex min-h-full flex-col"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col phone:px-4 phone:pb-8 phone:pt-5">
            <div className="flex min-w-0 flex-1 flex-col px-6 pb-10 pt-12 @3xl/desk:px-12 phone:contents">
              {props.primary}
            </div>
            <aside className="grid min-w-0 content-start gap-x-10 border-t border-border px-6 pb-10 @3xl/desk:grid-cols-2 @3xl/desk:px-12 phone:contents">
              {props.rail}
            </aside>
          </div>
        </Scroll>
      )}
    </AppPage>
  )
}
