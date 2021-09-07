export type MetaType = {
  created: Date
  modified: Date
  title: string
  slug: string
} & Record<string, any>

export interface MarkdownYAMLProperty {
  meta: MetaType
  text: string
}
