declare module 'object-scan' {
  export interface ObjectScanFilterArgs<Context = unknown> {
    parent: Record<string | number, any> | any[] | undefined
    property: string | number | undefined
    value: any
    context: Context
  }

  export interface ObjectScanOptions<Context = unknown> {
    rtn?: 'context'
    filterFn?: (args: ObjectScanFilterArgs<Context>) => unknown
  }

  export type ObjectScanner<Context = unknown> = (
    haystack: any,
    context?: Context,
  ) => Context

  export default function objectScan<Context = unknown>(
    needles: string[],
    options?: ObjectScanOptions<Context>,
  ): ObjectScanner<Context>
}
