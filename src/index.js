import fs from 'fs'
import qrcode from 'qrcode-terminal'
import { Client, Events, LocalAuth } from 'whatsapp-web.js'

import constants from './constants.js'

import * as cli from './cli/ui.js'
import { handleIncomingMessage } from './handlers/message.js'

import { initOpenAI } from './providers/openai.js'
import { initPerplexity } from './providers/perplexity.js'
import { setupCronJobs } from './cron/cron.js'

// Global error handlers to prevent crashes from whatsapp-web.js internal errors
process.on('unhandledRejection', (reason, promise) => {
  const errorMsg = reason?.message || String(reason)
  if (errorMsg.includes('markedUnread') || errorMsg.includes('undefined')) {
    console.error('[WhatsApp] Suppressed internal WhatsApp error:', errorMsg)
    return // Don't crash on known whatsapp-web.js issues
  }
  console.error('[Unhandled Rejection]', reason)
})

process.on('uncaughtException', (error) => {
  const errorMsg = error?.message || String(error)
  if (errorMsg.includes('markedUnread') || errorMsg.includes('undefined')) {
    console.error('[WhatsApp] Suppressed internal WhatsApp error:', errorMsg)
    return // Don't crash on known whatsapp-web.js issues
  }
  console.error('[Uncaught Exception]', error)
  process.exit(1)
})

let botReadyTimestamp = null

console.log('environment:', process.env.ENVIRONMENT)

// Use puppeteer's bundled Chromium - more reliable across environments
const client = new Client({
  authStrategy: new LocalAuth(),
  markOnlineOnConnect: false,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  },
})

const start = async () => {
  cli.printIntro()

  try {

    client.on(Events.QR_RECEIVED, qr => {
      qrcode.generate(qr, { small: true }, qrcode => {
        cli.printQRCode(qrcode)
      })
    })

    client.on(Events.LOADING_SCREEN, percent => {
      if (percent == '0') {
        cli.printLoading()
      }
    })

    client.on(Events.AUTHENTICATED, () => {
      cli.printAuthenticated()
    })

    client.on(Events.AUTHENTICATION_FAILURE, () => {
      cli.printAuthenticationFailure()
    })

    client.on(Events.READY, () => {
      cli.printOutro()

      botReadyTimestamp = new Date()

      if (process.env.JW_VERSION === 'true') {
        setupCronJobs(client)
      }

      initOpenAI()
      initPerplexity()
    })

    client.on(Events.MESSAGE_RECEIVED, async message => {
      try {
        if (message.from == constants.statusBroadcast) {
          cli.print(`Ignoring message from status broadcast: ${message.from}`)
          return
        }

        await handleIncomingMessage(message)
      } catch (error) {
        console.error('[MESSAGE_RECEIVED] Error handling message:', error.message)
      }
    })

    client.on(Events.MESSAGE_CREATE, async message => {
      try {
        if (message.from == constants.statusBroadcast) return

        if (!message.fromMe) return

        await handleIncomingMessage(message)
      } catch (error) {
        console.error('[MESSAGE_CREATE] Error handling message:', error.message)
      }
    })

    client.initialize().catch(console.error)
  } catch(error) {
    console.error('Error initializing WhatsApp client:', error)
    cli.printOutro()
    process.exit(1)
  }
}

start()

export { botReadyTimestamp }
