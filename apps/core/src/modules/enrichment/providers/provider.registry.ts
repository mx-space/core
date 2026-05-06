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

  match(url: URL): { provider: EnrichmentProvider; match: UrlMatchResult } | null {
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

  getProviderMetas(
    enabledChecker: (provider: EnrichmentProvider) => boolean,
  ): ProviderMeta[] {
    return this.providers.map((p) => ({
      name: p.name,
      displayName: p.displayName,
      category: p.category,
      enabled: enabledChecker(p),
      requiredConfigKeys: p.requiredConfigKeys,
      featureGateConfigKey: p.featureGateConfigKey,
    }))
  }
}
