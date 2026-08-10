import { useQuery } from '@tanstack/react-query'

import { getOption } from '~/api/options'
import type { AIConfig } from '~/features/settings/types/settings'
import { adminQueryKeys } from '~/query/keys'

export function useAiDefaultLangs(
  optionKey?: 'summaryTargetLanguages' | 'translationTargetLanguages',
): string[] {
  const query = useQuery({
    enabled: Boolean(optionKey),
    queryFn: () => getOption<AIConfig>('ai'),
    queryKey: adminQueryKeys.ai.defaultLangs(optionKey ?? ''),
    staleTime: 5 * 60 * 1000,
  })

  if (!optionKey) return []
  return query.data?.[optionKey] ?? []
}
