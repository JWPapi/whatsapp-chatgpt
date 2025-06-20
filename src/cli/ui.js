import { intro, note, outro, spinner } from '@clack/prompts'
import color from 'picocolors'

const s = spinner()

export const print = text => {
  console.log(color.green('◇') + '  ' + text)
}

export const printIntro = () => {
  intro(color.bgCyan(color.white(' Whatsapp ChatGPT Bot '))) // Removed DALL-E
  note("A Whatsapp bot that uses OpenAI's ChatGPT to generate text from a prompt.") // Removed DALL-E
  s.start('Starting')
}

export const printQRCode = qr => {
  // Removed : string type
  s.stop('Client is ready!')
  note(qr, 'Scan the QR code below to login to Whatsapp Web.')
  note(qr)
  note(qr)
  note(qr)
  note(qr)
}

export const printLoading = () => {
  s.stop('Authenticated!')
  s.start('Logging in')
}

export const printAuthenticated = () => {
  s.stop('Session started!')
  s.start('Opening session')
}

export const printAuthenticationFailure = () => {
  s.stop('Authentication failed!')
}

export const printOutro = () => {
  s.stop('Loaded!')
  outro('Whatsapp ChatGPT Bot is ready to use.') // Removed DALL-E
}
