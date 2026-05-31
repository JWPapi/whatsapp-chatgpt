import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import * as cli from '../cli/ui.js'
import type { TranscriptionResult } from '../types.js'

// Consecutive infrastructure failure tracking.
// Only connection/timeout errors count — not API validation errors.
// After MAX_CONSECUTIVE_FAILURES, Chrome is likely degraded → restart process.
const MAX_CONSECUTIVE_FAILURES = 3
let consecutiveInfraFailures = 0

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI()
    cli.print('[OpenAI] Client initialized')
  }
  return openaiClient
}

function isInfraError(error: unknown): boolean {
  const msg = (error as Error)?.message?.toLowerCase() ?? ''
  const name = (error as Error)?.constructor?.name ?? ''
  return (
    msg.includes('connection error') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('fetch failed') ||
    name === 'APIConnectionError'
  )
}

/**
 * Transcribe audio using OpenAI Whisper.
 * Retries once on transient errors before counting toward the failure threshold.
 */
export async function transcribeOpenAI(audioBuffer: Buffer): Promise<TranscriptionResult> {
  if (audioBuffer.length < 100) {
    cli.print(`[OpenAI] Audio buffer too small (${audioBuffer.length} bytes), skipping transcription`)
    return { text: '' }
  }

  const tempdir = os.tmpdir()
  const oggPath = path.join(tempdir, randomUUID() + '.ogg')
  fs.writeFileSync(oggPath, audioBuffer)

  const maxAttempts = 2

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = getClient()
        const transcription = await client.audio.transcriptions.create({
          file: fs.createReadStream(oggPath),
          model: 'whisper-1',
        })

        consecutiveInfraFailures = 0
        return { text: transcription.text }
      } catch (error) {
        const err = error as Error
        const infra = isInfraError(error)

        if (infra && attempt < maxAttempts) {
          cli.print(`[OpenAI] Transient error (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying in 3s...`)
          await new Promise(r => setTimeout(r, 3000))
          continue
        }

        // Final attempt failed
        cli.print(`[OpenAI] Whisper transcription failed: ${err.message}`)
        if (err.cause) cli.print(`[OpenAI] Cause: ${(err.cause as Error)?.message ?? err.cause}`)

        if (infra) {
          consecutiveInfraFailures++
          cli.print(`[OpenAI] Consecutive infra failures: ${consecutiveInfraFailures}/${MAX_CONSECUTIVE_FAILURES}`)

          if (consecutiveInfraFailures >= MAX_CONSECUTIVE_FAILURES) {
            cli.print(`[OpenAI] ${MAX_CONSECUTIVE_FAILURES} consecutive infra failures - Chrome likely degraded. Restarting...`)
            process.exit(1)
          }
        } else {
          // API-level error (bad request, rate limit, etc.) — don't count toward restart
          cli.print(`[OpenAI] Non-infra error (${err.constructor.name}), not counting toward restart threshold`)
        }

        return { text: '' }
      }
    }

    return { text: '' }
  } finally {
    try { fs.unlinkSync(oggPath) } catch {}
  }
}
