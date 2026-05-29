import { enhancedEditRendererConfig, enhancedRendererConfig } from '../core'
import { LinkCardWithEnrichment } from './linkcard/LinkCardWithEnrichment'

// Route the LinkCard renderer slot through a wrapper that injects the
// admin enrichment plugin (priority 1000, takes precedence over haklex built-ins)
// whenever an `EnrichmentFetcher` is provided via context. When no fetcher is
// present, the wrapper transparently delegates to the default
// `LinkCardRenderer`, so built-in plugins (githubPrPlugin, tmdbPlugin, …)
// continue to work.
let patched = false

export function patchLinkCardWithEnrichment(): void {
  if (patched) return
  patched = true
  ;(enhancedEditRendererConfig as { LinkCard?: unknown }).LinkCard =
    LinkCardWithEnrichment
  ;(enhancedRendererConfig as { LinkCard?: unknown }).LinkCard =
    LinkCardWithEnrichment
}

patchLinkCardWithEnrichment()
