import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { getOption, patchOption } from '~/api/options'
import type { AIConfig } from '~/features/settings/types/settings'
import { normalizeAIConfig } from '~/features/settings/utils/settings'

export const onboardingAiQueryKey = ['onboarding', 'ai'] as const

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
      await queryClient.invalidateQueries({
        queryKey: ['onboarding', 'models'],
      })
    },
    [queryClient],
  )
}
