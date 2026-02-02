import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import * as cli from '../cli/ui.js'
import type { TranscriptionResult } from '../types.js'

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI()
    cli.print('[OpenAI] Client initialized')
  }
  return openaiClient
}

/**
 * Transcribe audio using OpenAI Whisper
 */
export async function transcribeOpenAI(audioBuffer: Buffer): Promise<TranscriptionResult> {
  const tempdir = os.tmpdir()
  const oggPath = path.join(tempdir, randomUUID() + '.ogg')
  fs.writeFileSync(oggPath, audioBuffer)

  try {
    const client = getClient()
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(oggPath),
      model: 'whisper-1',
    })

    return {
      text: transcription.text,
    }
  } catch (error) {
    const err = error as Error
    cli.print(`[OpenAI] Whisper transcription failed: ${err.message}`)
    return {
      text: '',
      language: '',
    }
  } finally {
    fs.unlinkSync(oggPath)
  }
}
