import { closedUpdateTipsStorageKey } from '../constants'
import type { ClosedUpdateTipKey, ClosedUpdateTips } from '../types/dashboard'

export function readClosedUpdateTips(): ClosedUpdateTips {
  try {
    return {
      dashboard: null,
      system: null,
      ...(JSON.parse(
        localStorage.getItem(closedUpdateTipsStorageKey) || '{}',
      ) as {
        dashboard?: null | string
        system?: null | string
      }),
    }
  } catch {
    return {
      dashboard: null,
      system: null,
    }
  }
}

export function writeClosedUpdateTip(
  type: ClosedUpdateTipKey,
  version: string,
) {
  const tips = readClosedUpdateTips()
  localStorage.setItem(
    closedUpdateTipsStorageKey,
    JSON.stringify({
      ...tips,
      [type]: version,
    }),
  )
}
