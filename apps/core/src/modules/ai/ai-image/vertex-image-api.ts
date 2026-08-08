import sharp from 'sharp'

import {
  buildVertexPublisherModelUrl,
  getVertexHeaders,
  readVertexError,
  type VertexConnectionConfig,
} from '../vertex/vertex-api'
import type {
  GeneratedImage,
  ImageGenerateOptions,
} from './image-runtime.interface'

export async function generateVertexImagenImage(input: {
  apiKey: string
  connection: VertexConnectionConfig
  model: string
  options: ImageGenerateOptions
}): Promise<GeneratedImage[]> {
  if (input.options.referenceImages?.length) {
    throw new Error('Vertex Imagen reference images are not supported')
  }
  const mimeType = input.options.format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const response = await fetch(
    buildVertexPublisherModelUrl({
      config: input.connection,
      method: 'predict',
      model: input.model,
      version: 'v1',
    }),
    {
      method: 'POST',
      headers: getVertexHeaders(input.apiKey),
      body: JSON.stringify({
        instances: [{ prompt: input.options.prompt }],
        parameters: {
          sampleCount: 1,
          ...(input.options.aspectRatio
            ? { aspectRatio: input.options.aspectRatio }
            : {}),
          outputOptions: { mimeType },
          ...input.options.providerParams,
        },
      }),
      signal: input.options.signal,
    },
  )

  if (!response.ok) {
    throw new Error(
      `Vertex image request failed (${response.status}): ${await readVertexError(response)}`,
    )
  }

  const payload = (await response.json()) as {
    predictions?: Array<{
      bytesBase64Encoded?: unknown
      mimeType?: unknown
    }>
  }
  const images = (payload.predictions ?? [])
    .map((prediction): GeneratedImage | null => {
      if (typeof prediction.bytesBase64Encoded !== 'string') return null
      const buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64')
      if (buffer.length === 0) return null
      return {
        buffer,
        mimeType:
          typeof prediction.mimeType === 'string'
            ? prediction.mimeType
            : mimeType,
      }
    })
    .filter((image): image is GeneratedImage => image !== null)
  return transcodeVertexImages(images, input.options)
}

export async function generateVertexGeminiImage(input: {
  apiKey: string
  connection: VertexConnectionConfig
  model: string
  options: ImageGenerateOptions
}): Promise<GeneratedImage[]> {
  const parts: Array<Record<string, unknown>> = [
    { text: input.options.prompt },
    ...(input.options.referenceImages ?? []).map((image) => ({
      inline_data: {
        data: image.data.toString('base64'),
        mime_type: image.mimeType,
      },
    })),
  ]
  const response = await fetch(
    buildVertexPublisherModelUrl({
      config: input.connection,
      location: 'global',
      method: 'generateContent',
      model: input.model,
      version: 'v1',
    }),
    {
      method: 'POST',
      headers: getVertexHeaders(input.apiKey),
      body: JSON.stringify({
        contents: { role: 'user', parts },
        generation_config: {
          response_modalities: ['TEXT', 'IMAGE'],
          ...(input.options.aspectRatio
            ? { image_config: { aspect_ratio: input.options.aspectRatio } }
            : {}),
        },
        ...input.options.providerParams,
      }),
      signal: input.options.signal,
    },
  )
  if (!response.ok) {
    throw new Error(
      `Vertex image request failed (${response.status}): ${await readVertexError(response)}`,
    )
  }
  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: unknown; mimeType?: unknown }
          inline_data?: { data?: unknown; mime_type?: unknown }
        }>
      }
    }>
  }
  const images = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part): GeneratedImage | null => {
      const data = part.inlineData?.data ?? part.inline_data?.data
      const mimeType =
        part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? 'image/png'
      if (typeof data !== 'string' || typeof mimeType !== 'string') return null
      const buffer = Buffer.from(data, 'base64')
      return buffer.length > 0 ? { buffer, mimeType } : null
    })
    .filter((image): image is GeneratedImage => image !== null)
  return transcodeVertexImages(images, input.options)
}

async function transcodeVertexImages(
  images: GeneratedImage[],
  options: ImageGenerateOptions,
): Promise<GeneratedImage[]> {
  const targetMimeType =
    options.format === 'jpeg'
      ? 'image/jpeg'
      : options.format === 'webp'
        ? 'image/webp'
        : 'image/png'
  const quality =
    options.quality === 'low' ? 65 : options.quality === 'high' ? 95 : 82
  return Promise.all(
    images.map(async (image) => {
      if (image.mimeType === targetMimeType) return image
      const pipeline = sharp(image.buffer)
      const buffer =
        targetMimeType === 'image/jpeg'
          ? await pipeline.jpeg({ quality }).toBuffer()
          : targetMimeType === 'image/webp'
            ? await pipeline.webp({ quality }).toBuffer()
            : await pipeline.png().toBuffer()
      return { buffer, mimeType: targetMimeType }
    }),
  )
}
