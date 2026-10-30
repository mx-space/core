import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { Injectable, Logger } from '@nestjs/common'
import sharp from 'sharp'

import { AppErrorCode, createAppException } from '~/common/errors'
import { TEMP_DIR } from '~/constants/path.constant'
import { generateDefaultConfig } from '~/modules/configs/configs.default'
import { ConfigsService } from '~/modules/configs/configs.service'

const WEBP_SKIPPED_EXTENSIONS = new Set(['.svg', '.webp'])

export interface ProcessedImage {
  buffer: Buffer
  filename: string
  contentType: string
}

export interface TranscodedVideo {
  path: string
  filename: string
  contentType: string
  cleanup: () => Promise<void>
}

const replaceExtension = (filename: string, ext: string) => {
  const current = path.extname(filename)
  return `${current ? filename.slice(0, -current.length) : filename}${ext}`
}

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name)

  constructor(private readonly configsService: ConfigsService) {}

  async isVideoTranscodeEnabled() {
    const options = await this.getOptions()
    return options.videoToWebm
  }

  async processImage(
    buffer: Buffer,
    filename: string,
    { stripMetadata = false }: { stripMetadata?: boolean } = {},
  ): Promise<ProcessedImage | null> {
    const options = await this.getOptions()
    if (!options.imageToWebp) return null
    if (WEBP_SKIPPED_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
      return null
    }

    try {
      let image = sharp(buffer, { animated: true, autoOrient: true })
      if (options.imageMaxDimension) {
        image = image.resize({
          width: options.imageMaxDimension,
          height: options.imageMaxDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
      }
      if (options.imageKeepMetadata && !stripMetadata) {
        image = image.keepExif().keepIccProfile()
      }
      const output = await image
        .webp({
          quality: options.imageQuality,
          effort: options.imageEffort,
          lossless: options.imageLossless,
        })
        .toBuffer()
      return {
        buffer: output,
        filename: replaceExtension(filename, '.webp'),
        contentType: 'image/webp',
      }
    } catch (error) {
      this.logger.warn(
        `WebP conversion skipped for ${filename}: ${(error as Error).message}`,
      )
      return null
    }
  }

  async transcodeVideo(
    input: Readable & { truncated?: boolean },
    filename: string,
  ): Promise<TranscodedVideo | null> {
    const options = await this.getOptions()
    if (!options.videoToWebm) return null
    if (path.extname(filename).toLowerCase() === '.webm') return null

    await mkdir(TEMP_DIR, { recursive: true })
    const workDir = await mkdtemp(path.join(TEMP_DIR, 'media-'))
    const cleanup = () => rm(workDir, { recursive: true, force: true })

    try {
      const sourcePath = path.join(workDir, `source${path.extname(filename)}`)
      await pipeline(input, createWriteStream(sourcePath))
      if (input.truncated) {
        throw createAppException(AppErrorCode.FILE_TOO_LARGE)
      }

      const outputPath = path.join(workDir, 'output.webm')
      await this.runFfmpeg([
        '-hide_banner',
        '-nostdin',
        '-y',
        '-i',
        sourcePath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c:v',
        'libvpx-vp9',
        '-crf',
        String(options.videoCrf),
        '-b:v',
        '0',
        '-cpu-used',
        String(options.videoCpuUsed),
        '-row-mt',
        '1',
        ...(options.videoMaxHeight
          ? ['-vf', `scale=-2:'min(${options.videoMaxHeight},ih)'`]
          : []),
        '-c:a',
        'libopus',
        '-b:a',
        `${options.videoAudioBitrate}k`,
        outputPath,
      ])

      return {
        path: outputPath,
        filename: replaceExtension(filename, '.webm'),
        contentType: 'video/webm',
        cleanup,
      }
    } catch (error) {
      await cleanup()
      throw error
    }
  }

  private async getOptions() {
    const defaults = generateDefaultConfig().mediaProcessingOptions
    const stored = await this.configsService.get('mediaProcessingOptions')
    return {
      imageToWebp: stored?.imageToWebp ?? defaults.imageToWebp,
      imageQuality: stored?.imageQuality ?? defaults.imageQuality,
      imageEffort: stored?.imageEffort ?? defaults.imageEffort,
      imageLossless: stored?.imageLossless ?? defaults.imageLossless,
      imageKeepMetadata:
        stored?.imageKeepMetadata ?? defaults.imageKeepMetadata,
      imageMaxDimension: stored?.imageMaxDimension,
      videoToWebm: stored?.videoToWebm ?? defaults.videoToWebm,
      videoCrf: stored?.videoCrf ?? defaults.videoCrf,
      videoCpuUsed: stored?.videoCpuUsed ?? defaults.videoCpuUsed,
      videoAudioBitrate:
        stored?.videoAudioBitrate ?? defaults.videoAudioBitrate,
      videoMaxHeight: stored?.videoMaxHeight,
    }
  }

  private runFfmpeg(args: string[]) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-4000)
      })
      child.on('error', (error: NodeJS.ErrnoException) => {
        reject(
          createAppException(AppErrorCode.MEDIA_TRANSCODE_FAILED, {
            reason:
              error.code === 'ENOENT'
                ? 'ffmpeg is not installed on the server'
                : error.message,
          }),
        )
      })
      child.on('close', (code) => {
        if (code === 0) return resolve()
        this.logger.error(`ffmpeg exited with ${code}: ${stderr}`)
        const lastLine = stderr.trim().split('\n').at(-1)
        reject(
          createAppException(AppErrorCode.MEDIA_TRANSCODE_FAILED, {
            reason: lastLine || `ffmpeg exited with code ${code}`,
          }),
        )
      })
    })
  }
}
