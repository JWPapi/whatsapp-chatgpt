import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'
import ffmpeg from 'fluent-ffmpeg'
import config from '../config.js'

export let openai

export function initOpenAI() {
  openai = new OpenAI()
}

export async function transcribeOpenAI(audioBuffer) {
  let language = ''

  const tempdir = os.tmpdir()
  const oggPath = path.join(tempdir, randomUUID() + '.ogg')
  const wavFilename = randomUUID() + '.wav'
  const wavPath = path.join(tempdir, wavFilename)
  fs.writeFileSync(oggPath, audioBuffer)

  try {
    await convertOggToWav(oggPath, wavPath)
  } catch (e) {
    fs.unlinkSync(oggPath)
    return {
      text: '',
      language,
    }
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavPath),
      model: 'whisper-1',
    })

    return {
      text: transcription.text,
    }
  } catch (e) {
    console.error(e)
    return {
      text: '',
      language: language,
    }
  } finally {
    fs.unlinkSync(oggPath)
    fs.unlinkSync(wavPath)
  }
}

async function convertOggToWav(oggPath, wavPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(oggPath)
      .toFormat('wav')
      .outputOptions('-acodec pcm_s16le')
      .output(wavPath)
      .on('end', () => resolve())
      .on('error', err => reject(err))
      .run()
  })
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
