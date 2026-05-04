import type { ImageModel } from '~/shared/types/legacy-model.type'

export interface RSSProps {
  title: string
  url: string
  author: string
  description: string
  data: {
    created: Date | null
    modified: Date | null
    link: string
    title: string
    text: string
    id: string
    images: ImageModel[]
    contentFormat?: string
    content?: string
  }[]
}
