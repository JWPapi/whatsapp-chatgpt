import axios from 'axios'

const PUSHOVER_API_URL = 'https://api.pushover.net/1/messages.json'

export const sendPushoverNotification = async (message, title = 'Whatsapp Reminder') => {
  if (!userKey || !apiToken || !message) {
    const missingParams = []
    if (!message) missingParams.push('message')
    console.error(`[Pushover] Missing required parameters: ${missingParams.join(', ')}`)
    throw new Error(
      `Pushover notification failed: Missing parameters - ${missingParams.join(', ')}`,
    )
  }

  try {
    const response = await axios.post(PUSHOVER_API_URL, {
      token: process.env.PUSHOVER_API_TOKEN,
      user: process.env.PUSHOVER_USER_KEY,
      message: message,
      title
    })

    if (response.data && response.data.status === 1) {
      console.log(
        `[Pushover] Notification sent successfully to user ${userKey}. Request ID: ${response.data.request}`,
      )
    } else {
      // Pushover API returns 200 OK even for some errors, check response.data.errors
      const errorMessages =
        response.data && response.data.errors
          ? response.data.errors.join(', ')
          : 'Unknown error from Pushover'
      console.error(
        `[Pushover] Failed to send notification. Pushover errors: ${errorMessages}`,
        response.data,
      )
      throw new Error(`Pushover notification failed: ${errorMessages}`)
    }
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('[Pushover] API request error:', error.response.data)
      throw new Error(
        `Pushover API request failed with status ${error.response.status}: ${JSON.stringify(
          error.response.data.errors || error.response.data,
        )}`,
      )
    } else if (error.request) {
      // The request was made but no response was received
      console.error('[Pushover] No response received from API:', error.request)
      throw new Error('Pushover API request failed: No response received.')
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('[Pushover] Error setting up API request:', error.message)
      throw new Error(`Pushover API request setup failed: ${error.message}`)
    }
  }
}

// If you plan to export more from this file in the future:
// module.exports = { sendPushoverNotification };
// However, since you're using ES Modules (import/export), the named export above is standard.
