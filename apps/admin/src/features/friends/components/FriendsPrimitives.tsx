import { UserRound } from 'lucide-react'
import { useState } from 'react'

import { useI18n } from '~/i18n'

export function Avatar(props: { avatar: string; name: string }) {
  const [failed, setFailed] = useState(false)

  if (props.avatar && !failed) {
    return (
      <img
        alt=""
        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-800"
        onError={() => setFailed(true)}
        src={props.avatar}
      />
    )
  }

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
      {(props.name || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}

export function FriendsSkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((index) => (
        <tr className="animate-pulse" key={index}>
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-40 rounded bg-neutral-100 dark:bg-neutral-800" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-48 rounded bg-neutral-100 dark:bg-neutral-800" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-12 rounded bg-neutral-100 dark:bg-neutral-800" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-28 rounded bg-neutral-100 dark:bg-neutral-800" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-neutral-100 dark:bg-neutral-800" />
          </td>
          <td className="px-4 py-3">
            <div className="ml-auto h-8 w-28 rounded bg-neutral-100 dark:bg-neutral-800" />
          </td>
        </tr>
      ))}
    </>
  )
}

export function FriendsEmptyRow() {
  const { t } = useI18n()
  return (
    <tr>
      <td className="px-4 py-14 text-center" colSpan={7}>
        <div className="flex flex-col items-center text-sm text-neutral-500 dark:text-neutral-400">
          <UserRound
            aria-hidden="true"
            className="mb-3 size-10 text-neutral-300 dark:text-neutral-700"
          />
          {t('friends.empty')}
        </div>
      </td>
    </tr>
  )
}
