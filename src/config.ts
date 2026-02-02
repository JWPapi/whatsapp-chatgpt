import process from 'process'
import dotenv from 'dotenv'
import type { Config } from './types.js'

dotenv.config({ override: true })

function getEnvBooleanWithDefault(key: string, defaultValue: boolean): boolean {
  const envValue = process.env[key]?.toLowerCase()
  if (envValue == undefined || envValue == '') {
    return defaultValue
  }
  return envValue == 'true'
}

const config: Config = {
  groupchatsEnabled: getEnvBooleanWithDefault('GROUPCHATS_ENABLED', false),

  transcriptionMode: process.env.TRANSCRIPTION_MODE,

  agentPrefix: process.env.AGENT_PREFIX || 'jarvis',
  agentEnabled: getEnvBooleanWithDefault('AGENT_ENABLED', true),

  // Document generation
  documentGenerationEnabled: getEnvBooleanWithDefault('DOCUMENT_GENERATION_ENABLED', true),
  documentSizeThresholdBytes: parseInt(process.env.DOCUMENT_SIZE_THRESHOLD_BYTES || '5242880'),
  vercelBlobToken: process.env.BLOB_READ_WRITE_TOKEN || '',
}

export default config
