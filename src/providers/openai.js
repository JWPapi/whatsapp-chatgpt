import fs from 'fs';
import os from 'os';
import path from 'path';
import {randomUUID} from 'crypto';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import config from '../config';
import {getConfig} from '../handlers/ai-config';

export let openai;

export function initOpenAI() {
  openai = new OpenAI({
    apiKey: getConfig('gpt', 'apiKey'),
  });
}

export async function transcribeOpenAI(audioBuffer) {
  let language = '';

  const tempdir = os.tmpdir();
  const oggPath = path.join(tempdir, randomUUID() + '.ogg');
  const wavFilename = randomUUID() + '.wav';
  const wavPath = path.join(tempdir, wavFilename);
  fs.writeFileSync(oggPath, audioBuffer);

  try {
    await convertOggToWav(oggPath, wavPath);
  } catch (e) {
    fs.unlinkSync(oggPath);
    return {
      text: '', language,
    };
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavPath), model: 'whisper-1', language: config.transcriptionLanguage || undefined,
    });

    return {
      text: transcription.text, language: config.transcriptionLanguage || '',
    };
  } catch (e) {
    console.error(e);
    return {
      text: '', language: language,
    };
  } finally {
    fs.unlinkSync(oggPath);
    fs.unlinkSync(wavPath);
  }
}

async function convertOggToWav(oggPath, wavPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(oggPath).
        toFormat('wav').
        outputOptions('-acodec pcm_s16le').
        output(wavPath).
        on('end', () => resolve()).
        on('error', (err) => reject(err)).
        run();
  });
}

export async function chatCompletion(message, options = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model: config.openAIModel,
      messages: [
        {
          role: 'user', content: message,
        }],
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || getConfig('gpt', 'maxModelTokens'),
      top_p: options.top_p || 0.9,
      frequency_penalty: options.frequency_penalty || 0,
      presence_penalty: options.presence_penalty || 0,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error in chat completion:', error);
    throw error;
  }
}
