import { cn } from '~/utils/cn'

function Bar(props: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xs bg-surface-inset motion-reduce:animate-none',
        props.className,
      )}
    />
  )
}

function SectionSkeleton(props: { lines: number }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border py-7 phone:py-6">
      <Bar className="h-3 w-24" />
      {Array.from({ length: props.lines }, (_, index) => (
        <Bar className="h-4 w-full" key={index} />
      ))}
    </div>
  )
}

export function DeskPrimarySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col phone:order-1">
      <div className="flex flex-col gap-3 pb-8 phone:pb-6">
        <Bar className="h-3 w-48" />
        <Bar className="h-8 w-64" />
        <Bar className="h-4 w-80 max-w-full" />
      </div>
      <SectionSkeleton lines={3} />
      <SectionSkeleton lines={4} />
      <SectionSkeleton lines={2} />
    </div>
  )
}

export function DeskRailSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-6 phone:hidden">
      <Bar className="h-3 w-16" />
      <Bar className="h-8 w-full" />
      <Bar className="mt-6 h-3 w-16" />
      <Bar className="h-12 w-full" />
    </div>
  )
}
