import { startsWithIgnoreCase } from '../utils.js'

import config from '../config.js'

import * as cli from '../cli/ui.js'

import { handleMessageGPT } from './gpt.js'

import { transcribeOpenAI } from '../providers/openai.js'
import { handleMessageNotion } from './notion.js'
import { handleMessageResearch } from './handleMessageResearch.js'

import { botReadyTimestamp } from '../index.js'
import { handleExchangeCalculation } from './handleExchangeCalculation.js'

const TODO_KEYWORDS = ['todo', 'to do', 'to-do']

async function handleIncomingMessage(message) {
  let messageString = message.body

  if (message.hasQuotedMsg) {
    let { body } = message
    const quotedMessage = message._data.quotedMsg.body

    body = body.toLowerCase().trim()

    if (body === 'summarize') {
      const prompt = `Please summare this text: ${quotedMessage}`
      await handleMessageGPT(message, prompt)
      return
    }
    if (body === 'action') {
      const prompt = `Generate list of reasonable-sized action items, based on this message. Don’t overcomplicate stuff. Focus on the important tasks. Rather less than more. Only respond with the list.: ${quotedMessage}`
      await handleMessageGPT(message, prompt)
      return
    }

    if (body === config.gptPrefix) {
      const prompt = `What Can you add and say to this message? ${quotedMessage}`
      await handleMessageGPT(message, prompt)
      return
    }

    if (body === 'research') {
      const prompt = `Please research to this message: ${quotedMessage}`
      await handleMessageResearch(message, prompt)
      return
    }

    if (TODO_KEYWORDS.includes(body)) {
      await handleMessageNotion(message, quotedMessage)
      return
    }
  }

  if (message.timestamp != null && botReadyTimestamp != null) {
    const messageTimestamp = new Date(message.timestamp * 1000)

    if (messageTimestamp < botReadyTimestamp) {
      cli.print(`Ignoring old message: ${messageString || '[Media Message]'}`)
      return
    }
  } else if (botReadyTimestamp == null) {
    cli.print(
      `Ignoring message because bot is not ready yet: ${messageString || '[Media Message]'}`,
    )
    return
  }

  const chat = await message.getChat()
  if (chat.isGroup && !config.groupchatsEnabled) {
    cli.print(`Ignoring message from group chat ${chat.name} as group chats are disabled.`)
    return
  }

  if (message.hasMedia) {
    const media = await message.downloadMedia()

    if (!media || !media.mimetype.startsWith('audio/')) {
      console.log('non audio media')
      return
    }

    if (config.transcriptionMode === 'disabled') {
      cli.print('[Transcription] Received voice message but voice transcription is disabled.')
      return
    }

    const mediaBuffer = Buffer.from(media.data, 'base64')

    cli.print(`[Transcription] Transcribing audio with "${config.transcriptionMode}" ...`)

    const res = await transcribeOpenAI(mediaBuffer)

    const { text: transcribedText, language: transcribedLanguage } = res || {}

    if (!transcribedText) {
      message.reply("I couldn't understand what you said.")
      return
    }

    cli.print(
      `[Transcription] Transcription response: ${transcribedText} (language: ${
        transcribedLanguage || 'unknown'
      })`,
    )

    const reply = `${transcribedText}${
      transcribedLanguage ? ` (language: ${transcribedLanguage})` : ''
    }`
    message.reply(reply)

    return
  }

  if (startsWithIgnoreCase(messageString, config.gptPrefix)) {
    const prompt = messageString.substring(config.gptPrefix.length + 1)
    await handleMessageGPT(message, prompt)
    return
  }

  if (['exchange', 'xe'].some(keyword => startsWithIgnoreCase(messageString, keyword))) {
    const prompt = messageString.split(' ').slice(1).join(' ')
    await handleExchangeCalculation(message, prompt)
    return
  }

  if (TODO_KEYWORDS.some(keyword => startsWithIgnoreCase(messageString, keyword))) {
    const prompt = messageString.substring(5)
    await handleMessageNotion(message, prompt)
    return
  }

  if (startsWithIgnoreCase(messageString, 'research')) {
    await handleMessageResearch(message, messageString)
  }
}

export { handleIncomingMessage }
