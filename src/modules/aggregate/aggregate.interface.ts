export interface RSSProps {
  title: string
  url: string
  author: string
  data: {
    created: Date
    modified: Date
    link: string
    title: string
    text: string
  }[]
}
