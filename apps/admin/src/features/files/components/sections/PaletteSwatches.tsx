import { isPreviewColor } from '../../utils/format'

interface PaletteSwatchesProps {
  palette?: { dominant?: string; swatches?: string[] } | null
}

export function PaletteSwatches(props: PaletteSwatchesProps) {
  const palette = props.palette
  if (!palette) return <span>—</span>

  const swatches = (palette.swatches ?? []).filter(isPreviewColor)
  const dominant =
    palette.dominant && isPreviewColor(palette.dominant)
      ? palette.dominant
      : undefined

  if (!dominant && swatches.length === 0) return <span>—</span>

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dominant ? (
        <span
          className="inline-flex items-center gap-1.5 rounded border border-neutral-200 px-1.5 py-0.5 text-xs dark:border-neutral-800"
          title={dominant}
        >
          <span
            className="inline-block size-3 rounded border border-black/10 dark:border-white/10"
            style={{ backgroundColor: dominant }}
          />
          <span className="font-mono">{dominant}</span>
        </span>
      ) : null}
      {swatches.map((color) => (
        <span
          aria-hidden="true"
          className="inline-block size-3 rounded border border-black/10 dark:border-white/10"
          key={color}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  )
}
