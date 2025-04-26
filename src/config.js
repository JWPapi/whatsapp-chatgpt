import process from 'process'

// Environment variables
import dotenv from 'dotenv'

dotenv.config()

// Config
const config = {
  whitelistedPhoneNumbers: process.env.WHITELISTED_PHONE_NUMBERS?.split(',') || [],
  whitelistedEnabled: getEnvBooleanWithDefault('WHITELISTED_ENABLED', false),

  openAIAPIKeys: (process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY || '')
    .split(',')
    .filter(key => !!key), // Default:
  openAIModel: 'gpt-4o',
  maxModelTokens: getEnvMaxModelTokens(), // Default: 4096
  prePrompt: process.env.PRE_PROMPT, // Default: undefined

  // Prefix
  prefixEnabled: getEnvBooleanWithDefault('PREFIX_ENABLED', true), // Default: true
  prefixSkippedForMe: getEnvBooleanWithDefault('PREFIX_SKIPPED_FOR_ME', true), // Default: true
  gptPrefix: process.env.GPT_PREFIX || '!gpt', // Default: !gpt
  // dallePrefix removed
  resetPrefix: process.env.RESET_PREFIX || '!reset', // Default: !reset
  langChainPrefix: process.env.LANGCHAIN_PREFIX || '!lang', // Default: !lang

  // Groupchats
  groupchatsEnabled: getEnvBooleanWithDefault('GROUPCHATS_ENABLED', false), // Default: false


  // Add transcription related fields explicitly if they were in IConfig
  transcriptionMode: process.env.TRANSCRIPTION_MODE, // Use the imported JS object
  transcriptionLanguage: process.env.TRANSCRIPTION_LANGUAGE || 'en', // Default language if needed
}

/**
 * Get the max model tokens from the environment variable
 * @returns The max model tokens from the environment variable or 4096
 */
function getEnvMaxModelTokens() {
  const envValue = process.env.MAX_MODEL_TOKENS
  if (envValue == undefined || envValue == '') {
    return 4096
  }

  return parseInt(envValue)
}

/**
 * Get an environment variable as a boolean with a default value
 * @param key The environment variable key
 * @param defaultValue The default value
 * @returns The value of the environment variable or the default value
 */
function getEnvBooleanWithDefault(key, defaultValue) {
  // Removed : string, : boolean types
  const envValue = process.env[key]?.toLowerCase()
  if (envValue == undefined || envValue == '') {
    return defaultValue
  }

  return envValue == 'true'
}

// Export the config object using ESM default export
export default config
