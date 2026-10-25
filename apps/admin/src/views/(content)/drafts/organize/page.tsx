import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'drafts.organizer.title',
  hidden: true,
})

export { DraftOrganizerPage as default } from '~/features/drafts/components/DraftOrganizerPage'
