import config from '../config.js'
import * as cli from '../cli/ui.js'
import { transcribeOpenAI } from '../providers/openai.js'
import { runAgent, resetConversation } from '../providers/claude.js'
import { botReadyTimestamp } from '../index.js'

async function handleIncomingMessage(message) {
  let messageString = message.body

  // Filter old messages
  if (message.timestamp != null && botReadyTimestamp != null) {
    const messageTimestamp = new Date(message.timestamp * 1000)
    if (messageTimestamp < botReadyTimestamp) {
      cli.print(`Ignoring old message: ${messageString || '[Media Message]'}`)
      return
    }
  } else if (botReadyTimestamp == null) {
    cli.print(`Ignoring message because bot is not ready yet: ${messageString || '[Media Message]'}`)
    return
  }

  // Group chat filter
  const chat = await message.getChat()
  if (chat.isGroup && !config.groupchatsEnabled) {
    cli.print(`Ignoring message from group chat ${chat.name} as group chats are disabled.`)
    return
  }

  // Handle reset command
  if (messageString && messageString.toLowerCase().trim() === config.resetPrefix) {
    resetConversation(message.from)
    message.reply('Conversation reset.')
    return
  }

  // Handle voice messages: transcribe then send to agent
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
    cli.print(`[Transcription] Transcribing audio ...`)

    const res = await transcribeOpenAI(mediaBuffer)
    const { text: transcribedText } = res || {}

    if (!transcribedText) {
      message.reply("I couldn't understand what you said.")
      return
    }

    cli.print(`[Transcription] Transcribed: ${transcribedText}`)

    // Send transcription to agent so it can respond intelligently
    const agentInput = `🎤 Voice message transcription: "${transcribedText}"`
    const toolContext = { senderId: message.from, chatName: chat.name }

    try {
      const response = await runAgent(agentInput, message.from, toolContext)
      message.reply(`🎤 _${transcribedText}_\n\n${response}`)
    } catch (error) {
      console.error('Agent error on voice message:', error)
      message.reply(`🎤 _${transcribedText}_`)
    }
    return
  }

  // Build context for quoted messages
  let agentInput = messageString
  if (message.hasQuotedMsg) {
    const quotedMessage = message._data.quotedMsg.body
    agentInput = `[User replied to this message: "${quotedMessage}"]\n\nUser's reply: ${messageString}`
  }

  if (!agentInput || agentInput.trim() === '') return

  // Check prefix requirement
  if (config.prefixEnabled) {
    const isFromMe = message.fromMe
    const skipPrefix = isFromMe && config.prefixSkippedForMe

    if (!skipPrefix) {
      const prefixes = [config.gptPrefix, 'research', 'exchange', 'xe', 'todo', 'to do', 'to-do']
      const hasPrefix = prefixes.some(
        p => agentInput.toLowerCase().startsWith(p.toLowerCase()),
      )
      if (!hasPrefix) return
    }

    // Strip the gpt prefix if present, but keep others as context for the agent
    if (agentInput.toLowerCase().startsWith(config.gptPrefix.toLowerCase())) {
      agentInput = agentInput.substring(config.gptPrefix.length).trim()
    }
  }

  cli.print(`[Agent] Message from ${message.from}: ${agentInput}`)

  const toolContext = { senderId: message.from, chatName: chat.name }

  try {
    const response = await runAgent(agentInput, message.from, toolContext)
    if (response) {
      message.reply(response)
    }
  } catch (error) {
    console.error('Agent error:', error)
    message.reply('An error occurred, please contact the administrator. (' + error.message + ')')
  }
}

export { handleIncomingMessage }
