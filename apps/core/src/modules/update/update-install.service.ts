import { access, cp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Injectable } from '@nestjs/common'
import { LOCAL_ADMIN_ASSET_PATH } from '~/constants/path.constant'
import JSZip from 'jszip'
import pc from 'picocolors'

@Injectable()
export class UpdateInstallService {
  async extractAndInstall(
    buffer: ArrayBuffer,
    version: string,
    pushProgress: (msg: string) => Promise<void>,
  ): Promise<void> {
    await pushProgress('Extracting archive...\n')

    const tempDir = `${LOCAL_ADMIN_ASSET_PATH}_temp_${Date.now()}`
    await mkdir(tempDir, { recursive: true })

    try {
      const zip = new JSZip()
      await zip.loadAsync(buffer)

      const files = Object.keys(zip.files)
      if (files.length === 0) {
        throw new Error('Archive is empty')
      }

      await pushProgress(`Extracting ${files.length} files...\n`)

      for (const filename of files) {
        const file = zip.files[filename]
        if (!file.dir) {
          const content = await file.async('nodebuffer')
          const filePath = path.join(tempDir, filename)
          const dirPath = path.dirname(filePath)

          await mkdir(dirPath, { recursive: true })
          await writeFile(filePath, Uint8Array.from(content))
        }
      }

      const distPath = path.join(tempDir, 'dist')
      const contentPath = await access(distPath)
        .then(() => distPath)
        .catch(() => tempDir)

      const backupPath = `${LOCAL_ADMIN_ASSET_PATH}_backup_${Date.now()}`
      try {
        await access(LOCAL_ADMIN_ASSET_PATH)
        await this.moveDirectory(LOCAL_ADMIN_ASSET_PATH, backupPath)
        await pushProgress('Existing version backed up.\n')
      } catch {
        // no existing dir
      }

      try {
        await this.moveDirectory(contentPath, LOCAL_ADMIN_ASSET_PATH)

        await writeFile(
          path.join(LOCAL_ADMIN_ASSET_PATH, 'version'),
          version,
          'utf8',
        )

        await this.verifyInstallation()

        await pushProgress(pc.green('Installation completed successfully.\n'))

        if (
          await access(backupPath)
            .then(() => true)
            .catch(() => false)
        ) {
          await rm(backupPath, { recursive: true, force: true })
        }
      } catch (installError) {
        if (
          await access(backupPath)
            .then(() => true)
            .catch(() => false)
        ) {
          await rm(LOCAL_ADMIN_ASSET_PATH, { recursive: true, force: true })
          await this.moveDirectory(backupPath, LOCAL_ADMIN_ASSET_PATH)
          await pushProgress(
            pc.yellow('Installation failed, backup restored.\n'),
          )
        }
        throw installError
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  private async moveDirectory(src: string, dest: string): Promise<void> {
    try {
      await rename(src, dest)
    } catch {
      await cp(src, dest, { recursive: true })
      await rm(src, { recursive: true, force: true })
    }
  }

  private async verifyInstallation(): Promise<void> {
    const indexPath = path.join(LOCAL_ADMIN_ASSET_PATH, 'index.html')
    const versionPath = path.join(LOCAL_ADMIN_ASSET_PATH, 'version')

    try {
      await access(indexPath)
      await access(versionPath)
    } catch {
      throw new Error(
        'Installation verification failed: required files not found',
      )
    }
  }
}
