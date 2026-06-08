import { toast } from 'sonner'

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Failed to load module script',
  'Loading chunk',
  'Loading CSS chunk',
  'ChunkLoadError',
]

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false

  const name = (error as Error).name ?? ''
  const message = (error as Error).message ?? String(error)
  const combined = `${name} ${message}`

  return CHUNK_ERROR_PATTERNS.some((p) => combined.includes(p))
}

const RELOAD_KEY = 'mx-admin-chunk-reload'

export function notifyChunkError(): void {
  const reloaded = sessionStorage.getItem(RELOAD_KEY)
  if (reloaded) {
    sessionStorage.removeItem(RELOAD_KEY)
    toast.error(
      'A new version of the admin is available. Please refresh the page to update.',
    )
    return
  }
  sessionStorage.setItem(RELOAD_KEY, '1')
  window.location.reload()
}
