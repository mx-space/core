import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { getOption, patchOption } from '~/api/options'
import type { AIConfig } from '~/features/settings/types/settings'
import { normalizeAIConfig } from '~/features/settings/utils/settings'
import { adminQueryKeys } from '~/query/keys'

export const onboardingAiQueryKey = adminQueryKeys.onboarding.ai()

export function useOnboardingAiConfig() {
  return useQuery({
    queryFn: async () => normalizeAIConfig(await getOption<AIConfig>('ai')),
    queryKey: onboardingAiQueryKey,
  })
}

export function useSaveOnboardingAiConfig() {
  const queryClient = useQueryClient()
  return useCallback(
    async (next: AIConfig) => {
      await patchOption('ai', next)
      queryClient.setQueryData(onboardingAiQueryKey, next)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.onboarding.modelsRoot,
        }),
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.settings.root,
        }),
      ])
    },
    [queryClient],
  )
}
