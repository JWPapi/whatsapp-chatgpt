import qrcode from 'qrcode-terminal'
import { Client, Events, LocalAuth } from 'whatsapp-web.js'

import constants from './constants.js'
import * as cli from './cli/ui.js'
import { handleIncomingMessage } from './handlers/message.js'
import { setupCronJobs } from './cron/cron.js'
import { logAvailableFeatures } from './agent.js'

// Global error handlers to prevent crashes from whatsapp-web.js internal errors
process.on('unhandledRejection', (reason: unknown) => {
  const errorMsg = (reason as Error)?.message || String(reason)
  if (errorMsg.includes('markedUnread') || errorMsg.includes('undefined')) {
    console.error('[WhatsApp] Suppressed internal WhatsApp error:', errorMsg)
    return
  }
  console.error('[Unhandled Rejection]', reason)
})

process.on('uncaughtException', (error: Error) => {
  const errorMsg = error?.message || String(error)
  if (errorMsg.includes('markedUnread') || errorMsg.includes('undefined')) {
    console.error('[WhatsApp] Suppressed internal WhatsApp error:', errorMsg)
    return
  }
  console.error('[Uncaught Exception]', error)
  process.exit(1)
})

export let botReadyTimestamp: Date | null = null

console.log('environment:', process.env.ENVIRONMENT)

const client = new Client({
  authStrategy: new LocalAuth(),
  markOnlineOnConnect: false,
  userAgent: false as any,
  webVersionCache: { type: 'none' },
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/opt/puppeteer-cache/chrome/linux-140.0.7339.82/chrome-linux64/chrome',
    protocolTimeout: 120000, // 2 minute timeout
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
    ],
  },
})

const start = async (): Promise<void> => {
  cli.printIntro()

  try {
    client.on(Events.QR_RECEIVED, (qr: string) => {
      qrcode.generate(qr, { small: true }, (qrcode: string) => {
        cli.printQRCode(qrcode)
      })
    })

    client.on(Events.LOADING_SCREEN, (percent: string, message: string) => {
      console.log(`[DEBUG] LOADING_SCREEN: ${percent}% - ${message}`)
      if (percent == '0') {
        cli.printLoading()
      }
    })

    client.on(Events.AUTHENTICATED, () => {
      console.log('[DEBUG] AUTHENTICATED event fired')
      cli.printAuthenticated()

      // Debug: periodically check what the browser page looks like
      const debugInterval = setInterval(async () => {
        try {
          const page = (client as any).pupPage
          if (!page) { console.log('[DEBUG] No pupPage yet'); return }
          const url = page.url()
          const title = await page.title()
          const html = await page.evaluate(() => document.body?.innerHTML?.substring(0, 500) || 'no body')
          const errors = await page.evaluate(() => (window as any).__whatsappErrors || 'none')
          console.log(`[DEBUG] Page URL: ${url}`)
          console.log(`[DEBUG] Page title: ${title}`)
          console.log(`[DEBUG] Page HTML: ${html}`)
          console.log(`[DEBUG] Errors: ${JSON.stringify(errors)}`)
        } catch (e: any) {
          console.log(`[DEBUG] Page check error: ${e.message}`)
        }
      }, 5000)

      client.on(Events.READY, () => clearInterval(debugInterval))
    })

    client.on(Events.AUTHENTICATION_FAILURE, () => {
      console.log('[DEBUG] AUTHENTICATION_FAILURE event fired')
      cli.printAuthenticationFailure()
    })

    client.on(Events.DISCONNECTED, (reason: string) => {
      console.log(`[DEBUG] DISCONNECTED: ${reason}`)
    })

    client.on(Events.READY, () => {
      console.log('[DEBUG] READY event fired')
      cli.printOutro()
      logAvailableFeatures()

      botReadyTimestamp = new Date()

      if (process.env.JW_VERSION === 'true') {
        setupCronJobs(client)
      }
      // Providers use lazy initialization - no explicit init needed
    })

    client.on(Events.MESSAGE_RECEIVED, async message => {
      try {
        if (message.from == constants.statusBroadcast) {
          cli.print(`Ignoring message from status broadcast: ${message.from}`)
          return
        }

        await handleIncomingMessage(message)
      } catch (error) {
        const err = error as Error
        console.error('[MESSAGE_RECEIVED] Error handling message:', err.message)
      }
    })

    client.on(Events.MESSAGE_CREATE, async message => {
      try {
        if (message.from == constants.statusBroadcast) return

        if (!message.fromMe) return

        await handleIncomingMessage(message)
      } catch (error) {
        const err = error as Error
        console.error('[MESSAGE_CREATE] Error handling message:', err.message)
      }
    })

    client.initialize().catch(console.error)
  } catch (error) {
    console.error('Error initializing WhatsApp client:', error)
    cli.printOutro()
    process.exit(1)
  }
}

start()
