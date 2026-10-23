import type { DynamicCatalog } from '~/api/dynamic-components'
import { updateDynamicComponentEntry } from '~/api/dynamic-components'
import { uploadFile } from '~/api/files'

type ImportModule = (url: string) => Promise<unknown>

const importModule: ImportModule = (url) => import(/* @vite-ignore */ url)

interface MountableModule {
  default?: {
    mount?: (
      container: HTMLElement,
      input: { host: { theme: 'light' }; props: Record<string, unknown> },
    ) => { unmount?: () => void } | undefined
  }
}

export async function checkComponentModule(
  url: string,
  load: ImportModule = importModule,
  props: Record<string, unknown> = {},
): Promise<string | null> {
  try {
    const mod = (await load(url)) as MountableModule | null
    const mount = mod?.default?.mount
    if (typeof mount !== 'function')
      return 'The default export must be an object with a mount(container, input) function'
    const handle = mount(document.createElement('div'), {
      host: { theme: 'light' },
      props,
    })
    handle?.unmount?.()
    return null
  } catch (error) {
    return error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error)
  }
}

export async function fetchComponentSource(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'omit' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replaceAll(/[^\da-z]+/g, '-')
      .replaceAll(/^-|-$/g, '') || 'component'
  )
}

export async function saveComponentSource(
  entry: { id: string; name: string; url: string },
  source: string,
): Promise<DynamicCatalog> {
  const uploaded = await uploadFile(
    new File([source], `${fileSlug(entry.name)}-${crypto.randomUUID()}.js`, {
      type: 'text/javascript',
    }),
    'file',
    true,
  )
  return updateDynamicComponentEntry(entry.id, {
    parentUrl: entry.url,
    url: uploaded.url,
  })
}
