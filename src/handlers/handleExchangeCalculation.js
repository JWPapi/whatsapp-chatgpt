// const { Message } = require("whatsapp-web.js"); // Message type often not needed in JS
// Use the exported perplexity client instance directly
import exchange from '@abskmj/exchangeratesapi'

// Mapping from number to last conversation id (if needed for research context)
// const conversations = {};

export const handleExchangeCalculation = async (message, prompt) => { // Removed : Message, : string types, added export
  try {
    const exchangeRates = await exchange.rates({ access_key: process.env.EXCHANGE_RATES_API_TOKEN, base: 'USD' }).
      then(res => res.data.rates)

    console.log({exchangeRates})

    const [amount, baseCurrency] = prompt.split(' ')
    console.log('Amount:', amount)
    console.log('Base currency:', baseCurrency)
    const [, targetCurrency] = prompt.split(' to ')

    const amountInBaseCurrency = parseFloat(amount)
    console.log('Amount in base currency:', amountInBaseCurrency)

    const exchangeRateBase = exchangeRates[baseCurrency.toUpperCase()]
    console.log('Exchange rate base:', exchangeRateBase)
    const exchangeRateTarget = exchangeRates[targetCurrency.toUpperCase()]
    console.log('Exchange rate target:', exchangeRateTarget)
    const convertedAmount = (amountInBaseCurrency * exchangeRateTarget) / exchangeRateBase

    message.reply(
      `${amountInBaseCurrency} ${baseCurrency} is equal to ${convertedAmount.toFixed(2)} ${targetCurrency}`)

  } catch (error) {
    console.error('An error occured', error)
    message.reply('An error occured, please contact the administrator. (' + error.message + ')')
  }
}

// Removed module.exports as handleMessageResearch is now exported directly
