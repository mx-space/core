export interface RSSProps {
  title: string
  url: string
  author: string
  data: {
    created: Date | null
    modified: Date | null
    link: string
    title: string
    text: string
  }[]
}
