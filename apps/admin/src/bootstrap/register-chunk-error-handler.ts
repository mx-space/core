import { isChunkLoadError, notifyChunkError } from '~/utils/chunk-error'

export function registerChunkErrorHandler(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('vite:preloadError', (event) => {
    if (isChunkLoadError((event as any).payload)) {
      event.preventDefault()
      notifyChunkError()
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault()
      notifyChunkError()
    }
  })

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error ?? event.message)) {
      event.preventDefault()
      notifyChunkError()
    }
  })
}
