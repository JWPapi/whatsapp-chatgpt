import qrcode from 'qrcode-terminal'
import { Client, Events, LocalAuth } from 'whatsapp-web.js'

import constants from './constants.js'

import * as cli from './cli/ui.js'
import { handleIncomingMessage } from './handlers/message.js'

import { initOpenAI } from './providers/openai.js'
import { initPerplexity } from './providers/perplexity.js'
import { setupCronJobs } from './cron/cron.js'

let botReadyTimestamp = null

console.log('environment:', process.env.ENVIRONMENT)

// Initialize client outside the start function to make it accessible to the signal handler
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
      if (message.from == constants.statusBroadcast) {
        cli.print(`Ignoring message from status broadcast: ${message.from}`)
        return
      }

      await handleIncomingMessage(message)
    })

    client.on(Events.MESSAGE_CREATE, async message => {
      if (message.from == constants.statusBroadcast) return

      if (!message.fromMe) return

      await handleIncomingMessage(message)
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
