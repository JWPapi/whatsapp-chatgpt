// const { Message } = require("whatsapp-web.js"); // Message type often not needed in JS
// Use the exported perplexity client instance directly



export const handleMessageRemind = async (message, prompt) => { // Removed : Message, : string types, added export
  try {



  } catch (error) {
    console.error('An error occured', error)
    message.reply('An error occured, please contact the administrator. (' + error.message + ')')
  }
}

// Removed module.exports as handleMessageResearch is now exported directly
