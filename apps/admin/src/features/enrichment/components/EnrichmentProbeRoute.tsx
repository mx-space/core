import { useEnrichmentRouteContext } from './enrichment-route-context'
import { ProbeConsole } from './ProbeConsole'

export function EnrichmentProbeRoute() {
  const ctx = useEnrichmentRouteContext()
  const selected =
    ctx.probeHistory.find((entry) => entry.id === ctx.selectedProbeId) ?? null
  return (
    <ProbeConsole
      onBack={ctx.onBack}
      onProbed={(entry) => {
        ctx.onPushProbeEntry(entry)
        ctx.onSelectProbe(entry.id)
      }}
      selected={selected}
    />
  )
}

export default EnrichmentProbeRoute
