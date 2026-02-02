import { intro, note, outro, spinner } from '@clack/prompts'
import color from 'picocolors'

const s = spinner()

export const print = (text: string): void => {
  console.log(color.green('◇') + '  ' + text)
}

export const printIntro = (): void => {
  intro(color.bgCyan(color.white(' Whatsapp ChatGPT Bot ')))
  note("A Whatsapp bot that uses OpenAI's ChatGPT to generate text from a prompt.")
  s.start('Starting')
}

export const printQRCode = (qr: string): void => {
  s.stop('Client is ready!')
  note(qr, 'Scan the QR code below to login to Whatsapp Web.')
  note(qr)
  note(qr)
  note(qr)
  note(qr)
}

export const printLoading = (): void => {
  s.stop('Authenticated!')
  s.start('Logging in')
}

export const printAuthenticated = (): void => {
  s.stop('Session started!')
  s.start('Opening session')
}

export const printAuthenticationFailure = (): void => {
  s.stop('Authentication failed!')
}

export const printOutro = (): void => {
  s.stop('Loaded!')
  outro('Whatsapp ChatGPT Bot is ready to use.')
}
