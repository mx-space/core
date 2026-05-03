export type MetaType = {
  createdAt?: Date | null | undefined
  modifiedAt?: Date | null | undefined
  title: string
  slug: string
} & Record<string, any>

export interface MarkdownYAMLProperty {
  meta: MetaType
  text: string
}
