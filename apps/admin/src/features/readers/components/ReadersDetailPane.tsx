import { Loader2 } from 'lucide-react'
import type { ReaderModel } from '~/api/readers'
import type { useReaderMutations } from '../hooks/useReaderMutations'

import { Scroll } from '~/ui/primitives/scroll'

import { ReaderActionsFooter } from './ReaderActionsFooter'
import { ReaderActivityBlock } from './ReaderActivityBlock'
import { ReaderDetailHeader } from './ReaderDetailHeader'
import { ReaderIdentityBlock } from './ReaderIdentityBlock'
import { ReaderStatusBanner } from './ReaderStatusBanner'

export function ReadersDetailPane(props: {
  reader: ReaderModel
  isLoading: boolean
  currentUserId: string | null
  onBack: () => void
  mutations: ReturnType<typeof useReaderMutations>
}) {
  const { reader, mutations } = props

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReaderDetailHeader onBack={props.onBack} reader={reader} />

      <div className="relative min-h-0 flex-1">
        {props.isLoading ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center py-2">
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin text-neutral-400"
            />
          </div>
        ) : null}
        <Scroll className="h-full" innerClassName="flex flex-col gap-6 p-4">
          <ReaderStatusBanner
            onUnban={() => mutations.unbanReader.mutate(reader.id)}
            reader={reader}
            unbanPending={mutations.unbanReader.isPending}
          />
          <ReaderIdentityBlock reader={reader} />
          <ReaderActivityBlock reader={reader} />
        </Scroll>
      </div>

      <ReaderActionsFooter
        currentUserId={props.currentUserId}
        mutations={mutations}
        reader={reader}
      />
    </div>
  )
}
