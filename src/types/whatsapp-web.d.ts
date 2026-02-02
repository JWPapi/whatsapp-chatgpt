import 'whatsapp-web.js'

declare module 'whatsapp-web.js' {
  interface ClientOptions {
    markOnlineOnConnect?: boolean
  }
}
