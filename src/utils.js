const startsWithIgnoreCase = (str, prefix) => {
    // Add checks for null/undefined inputs for robustness
    if (typeof str !== 'string' || typeof prefix !== 'string') {
        return false;
    }
    return str.toLowerCase().startsWith(prefix.toLowerCase());
};

/**
 * Safely reply to a message, catching whatsapp-web.js internal errors
 * like "Cannot read properties of undefined (reading 'markedUnread')"
 */
const safeReply = async (message, content, chatId, options = { sendSeen: false }) => {
  try {
    return await message.reply(content, chatId, options)
  } catch (error) {
    if (error.message?.includes('markedUnread') || error.message?.includes('undefined')) {
      console.error('[SafeReply] WhatsApp internal error, attempting fallback send:', error.message)
      try {
        const chat = await message.getChat()
        return await chat.sendMessage(content)
      } catch (fallbackError) {
        console.error('[SafeReply] Fallback send also failed:', fallbackError.message)
        throw fallbackError
      }
    }
    throw error
  }
}

/**
 * Safely send a message to a chat, catching whatsapp-web.js internal errors
 */
const safeSendMessage = async (client, chatId, content, options = { sendSeen: false }) => {
  try {
    return await client.sendMessage(chatId, content, options)
  } catch (error) {
    if (error.message?.includes('markedUnread') || error.message?.includes('undefined')) {
      console.error('[SafeSend] WhatsApp internal error:', error.message)
      // Retry once after a short delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      try {
        return await client.sendMessage(chatId, content, options)
      } catch (retryError) {
        console.error('[SafeSend] Retry also failed:', retryError.message)
        throw retryError
      }
    }
    throw error
  }
}

export { startsWithIgnoreCase, safeReply, safeSendMessage };
