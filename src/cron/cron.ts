import cron from 'node-cron'
import axios from 'axios'
import { safeSendMessage } from '../utils.js'
import type { Client } from '../types.js'

async function sendScheduledMessage(client: Client, chatId: string, message: string): Promise<void> {
  try {
    console.log(`[Cron] Attempting to send message to ${chatId}: "${message}"`)
    await safeSendMessage(client, chatId, message)
    console.log(`[Cron] Message sent successfully to ${chatId}.`)
  } catch (error) {
    console.error(`[Cron] Failed to send message to ${chatId}:`, error)
  }
}

async function getSkillsMessage(client: Client): Promise<void> {
  const apiResponse = await axios.get('https://dbwagner.vercel.app/api/wa-reporting')
  await sendScheduledMessage(client, '4915140773278@c.us', apiResponse.data)
}

export async function setupCronJobs(client: Client): Promise<void> {
  console.log('[Cron] Setting up cron jobs...')

  cron.schedule(
    '5 0 * * *',
    () => {
      getSkillsMessage(client)
    },
    {
      scheduled: true,
      timezone: 'Europe/London',
    },
  )

  console.log('[Cron] Cron jobs scheduled.')
}
