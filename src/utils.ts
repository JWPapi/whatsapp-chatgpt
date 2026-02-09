import type { Message, Client } from './types.js'
import { MessageMedia } from 'whatsapp-web.js'

// WhatsApp message size limit
export const WHATSAPP_MAX_LENGTH = 4000

/**
 * Get chat ID from message for conversation tracking
 */
export function getChatId(message: Message): string {
  return message.from || 'unknown'
}

/**
 * Split long messages into chunks that fit WhatsApp's size limit.
 * Tries to split on paragraph breaks, line breaks, or spaces for readability.
 */
export function chunkMessage(text: string, maxLength: number = WHATSAPP_MAX_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text]
  }

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    // Try to split at paragraph break, then line break, then space
    let splitIndex = remaining.lastIndexOf('\n\n', maxLength)
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf('\n', maxLength)
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(' ', maxLength)
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength
    }

    chunks.push(remaining.substring(0, splitIndex).trim())
    remaining = remaining.substring(splitIndex).trim()
  }

  return chunks
}

export const startsWithIgnoreCase = (str: string, prefix: string): boolean => {
  if (typeof str !== 'string' || typeof prefix !== 'string') {
    return false
  }
  const lowerStr = str.toLowerCase()
  const lowerPrefix = prefix.toLowerCase()

  // Check if starts with prefix followed by space or end of string
  if (!lowerStr.startsWith(lowerPrefix)) {
    return false
  }

  // Ensure prefix is followed by space, end of string, or is the whole string
  const nextChar = str[prefix.length]
  return nextChar === undefined || nextChar === ' '
}

interface ReplyOptions {
  sendSeen?: boolean
}

export const safeReply = async (
  message: Message,
  content: string,
  chatId?: string,
  options: ReplyOptions = { sendSeen: false },
): Promise<Message | undefined> => {
  try {
    return await message.reply(content, chatId, options)
  } catch (error) {
    const err = error as Error
    if (err.message?.includes('markedUnread') || err.message?.includes('undefined')) {
      console.error('[SafeReply] WhatsApp internal error, attempting fallback send:', err.message)
      try {
        const chat = await message.getChat()
        return await chat.sendMessage(content)
      } catch (fallbackError) {
        const fallbackErr = fallbackError as Error
        console.error('[SafeReply] Fallback send also failed:', fallbackErr.message)
        throw fallbackError
      }
    }
    throw error
  }
}

export const safeSendMessage = async (
  client: Client,
  chatId: string,
  content: string,
  options: ReplyOptions = { sendSeen: false },
): Promise<Message | undefined> => {
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.sendMessage(chatId, content, options)
    } catch (error) {
      const err = error as Error
      const isRetryable =
        err.message?.includes('markedUnread') ||
        err.message?.includes('undefined') ||
        err.message?.includes('ProtocolError') ||
        err.message?.includes('timed out')

      if (isRetryable && attempt < maxRetries) {
        const delay = attempt * 5000
        console.error(`[SafeSend] Attempt ${attempt}/${maxRetries} failed: ${err.message}. Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}

interface MediaOptions {
  caption?: string
  sendSeen?: boolean
}

export const safeReplyMedia = async (
  message: Message,
  media: { base64: string; mimetype: string; filename: string },
  options: MediaOptions = {},
): Promise<Message | undefined> => {
  const messageMedia = new MessageMedia(media.mimetype, media.base64, media.filename)

  try {
    return await message.reply(messageMedia, undefined, {
      caption: options.caption,
      sendSeen: options.sendSeen ?? false,
    })
  } catch (error) {
    const err = error as Error
    if (err.message?.includes('markedUnread') || err.message?.includes('undefined')) {
      console.error('[SafeReplyMedia] WhatsApp internal error, attempting fallback:', err.message)
      try {
        const chat = await message.getChat()
        return await chat.sendMessage(messageMedia, { caption: options.caption })
      } catch (fallbackError) {
        const fallbackErr = fallbackError as Error
        console.error('[SafeReplyMedia] Fallback also failed:', fallbackErr.message)
        throw fallbackError
      }
    }
    throw error
  }
}
