import qrcode from 'qrcode-terminal'
import { Client, Events, LocalAuth } from 'whatsapp-web.js'

import constants from './constants.js'

import * as cli from './cli/ui.js'
import { handleIncomingMessage } from './handlers/message.js'

import { initOpenAI } from './providers/openai.js'
import { initPerplexity } from './providers/perplexity.js'
import { setupCronJobs } from './cron/cron.js'

let botReadyTimestamp = null

// Initialize client outside the start function to make it accessible to the signal handler
const client = new Client({
  puppeteer: {
    args: ['--no-sandbox'],
  },
  authStrategy: new LocalAuth({
    dataPath: process.env.ENVIRONMENT === 'development' ? './wweb_auth_data' : '/var/data',
  }),
  webVersionCache: {
    type: 'remote',
    remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${process.env.WWEB_VERSION || '2.2412.54'}.html`, // Use env var or default
  },
})

const start = async () => {
  cli.printIntro()

  // Client initialization moved outside
  /*
  const client = new Client({
    puppeteer: {
      args: ['--no-sandbox'],
    },
    authStrategy: new LocalAuth({
      dataPath: process.env.ENVIRONMENT === 'development' ? './wweb_auth_data' : '/var/data',
    }),
    webVersionCache: {
      type: 'remote',
      remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${process.env.WWEB_VERSION || '2.2412.54'}.html`,
    },
  })
  */ // End of moved client initialization block

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

    setupCronJobs(client)

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

  client.initialize()
}

start()

// Graceful shutdown on Ctrl+C with timeout
process.on('SIGINT', async () => {
  console.log('\n[Process] SIGINT received. Attempting graceful shutdown...')

  const shutdownTimeout = 5000; // 5 seconds

  const destroyPromise = client.destroy().then(() => {
    console.log('[Client] WhatsApp client destroyed successfully.');
    return 'destroyed';
  }).catch(error => {
    console.error('[Client] Error destroying client:', error);
    return 'error';
  });

  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), shutdownTimeout));

  // Race destroy against timeout
  const result = await Promise.race([destroyPromise, timeoutPromise]);

  if (result === 'timeout') {
    console.warn(`[Process] Client destroy timed out after ${shutdownTimeout}ms. Forcing exit.`);
  } else if (result === 'error') {
    console.log('[Process] Exiting after client destroy error.');
  } else {
    console.log('[Process] Exiting after successful client destroy.');
  }

  process.exit(0); // Force exit in all cases after attempting destroy/timeout
})

export { botReadyTimestamp }
