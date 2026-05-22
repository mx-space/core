import type { z } from 'zod'

import { AppErrorCode, createAppException } from '~/common/errors'

export type ViewDef = z.ZodTypeAny

export type ViewMap = Record<string, ViewDef>

export type ViewName<TViews extends ViewMap> = keyof TViews & string

export type ViewOf<
  TViews extends ViewMap,
  K extends ViewName<TViews>,
> = z.infer<TViews[K]>

export function parseView<TViews extends ViewMap>(
  view: string,
  viewMap: TViews,
  row: unknown,
): z.infer<TViews[ViewName<TViews>]> {
  const schema = viewMap[view]
  if (!schema) {
    throw createAppException(AppErrorCode.INVALID_VIEW, {
      view,
      available: Object.keys(viewMap),
    })
  }
  return schema.parse(row) as z.infer<TViews[ViewName<TViews>]>
}
