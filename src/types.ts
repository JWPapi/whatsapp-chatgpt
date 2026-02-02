import type { Message, Client } from 'whatsapp-web.js'

export type { Message, Client }

export interface Config {
  groupchatsEnabled: boolean
  transcriptionMode: string | undefined
  agentPrefix: string
  agentEnabled: boolean
  // Document generation
  documentGenerationEnabled: boolean
  documentSizeThresholdBytes: number
  vercelBlobToken: string
}

export interface TranscriptionResult {
  text: string
  language?: string
}

// Document generation types
export interface GeneratedDocument {
  base64: string
  filename: string
  mimetype: string
  size: number
}

export interface DocumentAction extends GeneratedDocument {
  _action: 'send_document'
  caption?: string
}
