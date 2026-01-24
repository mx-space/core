import { FileReferenceService } from '~/modules/file/file-reference.service'
import { ImageMigrationService } from '~/processors/helper/helper.image-migration.service'
import { defineProvider } from 'test/helper/defineProvider'

export const fileReferenceProvider = defineProvider({
  provide: FileReferenceService,
  useValue: {
    async createPendingReference() {
      return {}
    },
    async activateReferences() {},
    async updateReferencesForDocument() {},
    async removeReferencesForDocument() {},
    async cleanupOrphanFiles() {
      return { deletedCount: 0, totalOrphan: 0 }
    },
    async getFileReferences() {
      return []
    },
    async getReferencesForDocument() {
      return []
    },
    async getOrphanFilesCount() {
      return 0
    },
  },
})

export const imageMigrationProvider = defineProvider({
  provide: ImageMigrationService,
  useValue: {
    async migrateImagesToS3(text: string, images: any[]) {
      return {
        newText: text,
        newImages: images || [],
        migratedCount: 0,
      }
    },
  },
})
