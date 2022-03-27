export type MetaType = {
  created?: Date | null | undefined
  modified?: Date | null | undefined
  title: string
  slug: string
} & Record<string, any>

export interface MarkdownYAMLProperty {
  meta: MetaType
  text: string
}
