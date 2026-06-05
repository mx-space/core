import { useThemeMode } from '~/theme'

import type { MapSlotProps } from './map-augment'
import { MapBlock } from './MapBlock'

export function MapBlockReadonly(props: MapSlotProps & { className?: string }) {
  const { isDark } = useThemeMode()
  return (
    <MapBlock
      className={props.className}
      isDark={isDark}
      pois={props.pois}
      src={props.track?.url}
      title={props.title}
      view={props.view}
    />
  )
}
