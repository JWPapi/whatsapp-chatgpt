import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import config from '../config.js'

export let openai

export function initOpenAI() {
  openai = new OpenAI()
}

export async function transcribeOpenAI(audioBuffer) {
  const tempdir = os.tmpdir()
  const oggPath = path.join(tempdir, randomUUID() + '.ogg')
  fs.writeFileSync(oggPath, audioBuffer)

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(oggPath),
      model: 'whisper-1',
    })

    return {
      text: transcription.text,
    }
  } catch (e) {
    console.error('[Transcription] OpenAI Whisper API failed:', e.message)
    return {
      text: '',
      language: '',
    }
  } finally {
    fs.unlinkSync(oggPath)
  }
}

export async function chatCompletion(message, options = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model: config.openAIModel,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
      max_completion_tokens: config.openAIModel === 'o1-mini' ? 40000 : undefined,
    })

    return completion.choices[0].message.content
  } catch (error) {
    console.error('Error in chat completion:', error)
    throw error
  }
}

// Add module.exports at the end
module.exports = {
  openai: () => openai, // Export a function to get the initialized instance
  initOpenAI,
  transcribeOpenAI,
  chatCompletion,
}
