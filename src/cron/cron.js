const cron = require('node-cron')
import axios from 'axios'

// Example function to demonstrate sending a message
async function sendScheduledMessage(client, chatId, message) {
  try {
    console.log(`[Cron] Attempting to send message to ${chatId}: "${message}"`)
    await client.sendMessage(chatId, message)
    console.log(`[Cron] Message sent successfully to ${chatId}.`)
  } catch (error) {
    console.error(`[Cron] Failed to send message to ${chatId}:`, error)
  }
}

async function setupCronJobs(client) {
  console.log('[Cron] Setting up cron jobs...')

  cron.schedule(
    '5 0  * * *',
    () => {
      generateSMMDealFinderMessage(client)
    },
    {
      scheduled: true,
      timezone: 'America/New_York', // Example timezone
    },
  )

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

async function generateSMMDealFinderMessage(client) {
  const apiResponse = await axios.get('https://smmdealfinder.com/api/wa-reporting')
  await sendScheduledMessage(client, '120363229907512639@g.us', apiResponse.data)
}

async function getSkillsMessage(client) {
  const apiResponse = await axios.get('https://dbwagner.vercel.app/api/wa-reporting')
  await sendScheduledMessage(client, '4915140773278@c.us', apiResponse.data)
}

// Export the function using module.exports
module.exports = { setupCronJobs }
