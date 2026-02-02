/**
 * Message Dispatcher - Routes incoming WhatsApp messages to the agent
 *
 * Flow:
 * 1. Timestamp/group validation
 * 2. Media handling (audio transcription)
 * 3. Prefixed messages (ag/jarvis) → agent directly
 * 4. Non-prefixed → agent evaluateMessage() (cheap Sonnet gate)
 */

import { startsWithIgnoreCase, safeReply, getChatId } from '../utils.js'
import config from '../config.js'
import * as cli from '../cli/ui.js'
import { transcribeOpenAI } from '../providers/openai.js'
import { botReadyTimestamp } from '../index.js'
import { handleMessage, evaluateMessage } from '../agent.js'
import type { Message } from '../types.js'

// ============================================================================
// Media Handling
// ============================================================================

/**
 * Transcribe audio message. Returns the transcribed text or null.
 */
async function transcribeAudio(message: Message): Promise<string | null> {
  if (!message.hasMedia) return null

  const media = await message.downloadMedia()

  if (!media || !media.mimetype.startsWith('audio/')) {
    cli.print('[Message] Received non-audio media, ignoring')
    return null
  }

  if (config.transcriptionMode === 'disabled') {
    cli.print('[Transcription] Voice transcription is disabled')
    return null
  }

  const mediaBuffer = Buffer.from(media.data, 'base64')
  cli.print(`[Transcription] Transcribing audio with "${config.transcriptionMode}"...`)

  const res = await transcribeOpenAI(mediaBuffer)
  const { text: transcribedText, language } = res || {}

  if (!transcribedText) {
    await safeReply(message, "I couldn't understand what you said.")
    return null
  }

  cli.print(`[Transcription] Result: ${transcribedText} (${language || 'unknown'})`)
  await safeReply(message, `🎤 ${transcribedText}`)
  return transcribedText
}

// ============================================================================
// Main Message Handler
// ============================================================================

async function handleIncomingMessage(message: Message): Promise<void> {
  const messageString = message.body

  cli.print(
    `[Message] From ${message.from?.slice(-4) || 'unknown'}: "${messageString?.substring(0, 50) || '[empty]'}"`,
  )

  // 1. Validate timestamp
  if (message.timestamp != null && botReadyTimestamp != null) {
    const messageTime = new Date(message.timestamp * 1000)
    if (messageTime < botReadyTimestamp) {
      cli.print(`[Message] Ignoring old message: ${messageString || '[Media]'}`)
      return
    }
  } else if (botReadyTimestamp == null) {
    cli.print(`[Message] Bot not ready, ignoring: ${messageString || '[Media]'}`)
    return
  }

  // 2. Filter group chats if disabled
  const chat = await message.getChat()
  if (chat.isGroup && !config.groupchatsEnabled) {
    cli.print(`[Message] Ignoring group chat: ${chat.name}`)
    return
  }

  const chatId = getChatId(message)

  // 3. Handle audio messages — transcribe, then route through same logic as text
  let textToProcess = messageString
  if (message.hasMedia) {
    const transcribed = await transcribeAudio(message)
    if (!transcribed) return
    textToProcess = transcribed
  }

  if (!textToProcess?.trim()) return

  // 4. Check for agent prefix (ag/jarvis) — direct to agent
  if (startsWithIgnoreCase(textToProcess, config.agentPrefix)) {
    const prompt = textToProcess.substring(config.agentPrefix.length + 1).trim()
    if (prompt) {
      await handleMessage(message, prompt, chatId)
    } else {
      await safeReply(message, "Hey! I'm listening. What can I help you with?")
    }
    return
  }

  if (startsWithIgnoreCase(textToProcess, 'jarvis')) {
    const prompt = textToProcess.substring('jarvis'.length + 1).trim()
    if (prompt) {
      await handleMessage(message, prompt, chatId)
    } else {
      await safeReply(message, "Hey! I'm listening. What can I help you with?")
    }
    return
  }

  // 5. Non-prefixed messages → let Sonnet evaluate if agent should respond
  if (config.agentEnabled) {
    const responded = await evaluateMessage(message, textToProcess, chatId)
    if (!responded) {
      cli.print(`[Jarvis] Chose not to respond to: "${textToProcess.substring(0, 30)}..."`)
    }
  }
}

export { handleIncomingMessage }
