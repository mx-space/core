import { FileReferenceService } from '~/modules/file/file-reference.service'
import { ImageMigrationService } from '~/processors/helper/helper.image-migration.service'
import { ImageService } from '~/processors/helper/helper.image.service'
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

export const imageServiceProvider = defineProvider({
  provide: ImageService,
  useValue: {
    onModuleInit() {},
    async saveImageDimensionsFromMarkdownText() {
      // Mock: do nothing, skip image processing in tests
    },
    async getOnlineImageSizeAndMeta() {
      return {
        size: { width: 100, height: 100, type: 'image/png' },
        accent: '#ffffff',
        blurHash: '',
      }
    },
  },
})
