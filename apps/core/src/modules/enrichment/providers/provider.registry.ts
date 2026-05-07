import { Injectable, Logger } from '@nestjs/common'

import type { ProviderMeta, UrlMatchResult } from '../enrichment.types'
import type { EnrichmentProvider } from './provider.interface'

@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name)
  private providers: EnrichmentProvider[] = []

  register(provider: EnrichmentProvider) {
    this.providers.push(provider)
    this.providers.sort((a, b) => b.priority - a.priority)
    this.logger.log(
      `Registered enrichment provider: ${provider.name} (priority: ${provider.priority})`,
    )
  }

  match(
    url: URL,
  ): { provider: EnrichmentProvider; match: UrlMatchResult } | null {
    for (const provider of this.providers) {
      const result = provider.matchUrl(url)
      if (result) {
        return { provider, match: result }
      }
    }
    return null
  }

  getByName(name: string): EnrichmentProvider | undefined {
    return this.providers.find((p) => p.name === name)
  }

  getAllProviders(): EnrichmentProvider[] {
    return [...this.providers]
  }

  /**
   * Build {@link ProviderMeta}s for the dashboard. `evaluator` is given the
   * provider so callers can compute live `enabled` / `ready` / `missingKeys`
   * against the current `thirdPartyServiceIntegration` config — none of which
   * the registry can determine on its own.
   */
  getProviderMetas(
    evaluator: (provider: EnrichmentProvider) => {
      enabled: boolean
      ready: boolean
      missingKeys: string[]
    },
  ): ProviderMeta[] {
    return this.providers.map((p) => {
      const { enabled, ready, missingKeys } = evaluator(p)
      return {
        name: p.name,
        displayName: p.displayName,
        category: p.category,
        enabled,
        ready,
        missingKeys,
        requiredConfigKeys: p.requiredConfigKeys,
        featureGateConfigKey: p.featureGateConfigKey,
        localeAware: p.localeAware === true,
        supportedLocales: p.supportedLocales,
      }
    })
  }
}
