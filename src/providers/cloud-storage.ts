import { put } from '@vercel/blob'
import config from '../config.js'

export interface UploadResult {
  url: string
  downloadUrl: string
}

export async function uploadToCloud(
  base64: string,
  filename: string,
  mimetype: string,
): Promise<UploadResult> {
  if (!config.vercelBlobToken) {
    throw new Error('BLOB_READ_WRITE_TOKEN not configured for cloud uploads')
  }

  const buffer = Buffer.from(base64, 'base64')

  const blob = await put(filename, buffer, {
    access: 'public',
    contentType: mimetype,
    token: config.vercelBlobToken,
  })

  return {
    url: blob.url,
    downloadUrl: blob.downloadUrl,
  }
}
