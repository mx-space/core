import { m } from 'motion/react'
import type { FC } from 'react'

export const ContextBanner: FC = () => {
  const hours = new Date().getHours()
  const greeting =
    hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-20 bg-material-thin border border-border rounded-xl p-6 mb-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <i className="w-6 h-6 i-mingcute-sun-line text-accent" />
            <span className="text-lg font-medium text-text">{greeting}!</span>
          </div>
          <p className="text-sm text-placeholder-text mt-1">
            You're all set. Keep an eye on live activities.
          </p>
        </div>

        <button
          type="button"
          className="px-2 py-1 rounded-md hover:bg-fill transition-colors text-placeholder-text"
          aria-label="More"
        >
          <i className="i-mingcute-arrow-down-line w-4 h-4" />
        </button>
      </div>
    </m.div>
  )
}
