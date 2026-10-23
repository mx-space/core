import { ColorSchemeProvider } from '@haklex/rich-editor/static'
import { DynamicHostRenderer } from '@haklex/rich-ext-dynamic'

import { useThemeMode } from '~/theme'
import { isAllowedDynamicUrl } from '~/vendor/rich-editor/utils/dynamic-catalog'

export function DynamicComponentPreview(props: {
  componentProps: Record<string, unknown>
  initialHeight: number
  url: string
  validateUrl?: (url: string) => boolean
}) {
  const { isDark } = useThemeMode()
  return (
    <ColorSchemeProvider colorScheme={isDark ? 'dark' : 'light'}>
      <DynamicHostRenderer
        componentProps={props.componentProps}
        initialHeight={props.initialHeight}
        key={props.url}
        url={props.url}
        validateUrl={props.validateUrl ?? isAllowedDynamicUrl}
      />
    </ColorSchemeProvider>
  )
}
