import type { CSSProperties } from 'react'

import { bgUrl } from '~/constants/env'

export const authBackdropClassName =
  'auth-light relative min-h-dvh overflow-hidden bg-white p-4 text-fg'

export const authBackdropStyle: CSSProperties = {
  backgroundImage: bgUrl
    ? `linear-gradient(rgba(247, 251, 255, 0.86), rgba(255, 255, 255, 0.92)), url(${bgUrl})`
    : 'linear-gradient(180deg, #e9f5fe 0%, #f7fbff 60%, #ffffff 100%)',
  backgroundPosition: 'center',
  backgroundSize: 'cover',
}
