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

export interface DeskSummary {
  unreadComments: {
    count: number
    latest: {
      id: string
      author: string
      text: string
      refTitle: string | null
    } | null
  }
  linkApplications: {
    count: number
    latest: { id: string; name: string; url: string } | null
  }
  scheduledNotes: Array<{
    id: string
    nid: number
    title: string | null
    publicAt: string
  }>
}
