import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod/v4'
import exchange from '@abskmj/exchangeratesapi'
import * as cli from '../cli/ui.js'

interface ExchangeRates {
  [currency: string]: number
}

export const currencyExchangeTool = tool(
  'currency_exchange',
  'Convert an amount from one currency to another using live exchange rates. Example: convert 100 USD to EUR.',
  {
    amount: z.number().describe('The amount to convert'),
    from_currency: z.string().describe('Source currency code (e.g., USD, EUR, GBP)'),
    to_currency: z.string().describe('Target currency code (e.g., USD, EUR, GBP)'),
  },
  async args => {
    try {
      const response = await exchange.rates({
        access_key: process.env.EXCHANGE_RATES_API_TOKEN,
        base: 'USD',
      })
      const rates: ExchangeRates = response.data.rates

      const fromRate = rates[args.from_currency.toUpperCase()]
      const toRate = rates[args.to_currency.toUpperCase()]

      if (!fromRate || !toRate) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unknown currency. Available: ${Object.keys(rates).join(', ')}`,
            },
          ],
          isError: true,
        }
      }

      const converted = (args.amount * toRate) / fromRate

      cli.print(
        `[Exchange] ${args.amount} ${args.from_currency} -> ${converted.toFixed(2)} ${args.to_currency}`,
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: `${args.amount} ${args.from_currency.toUpperCase()} = ${converted.toFixed(2)} ${args.to_currency.toUpperCase()}`,
          },
        ],
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      cli.print(`[Exchange] Error: ${err}`)
      return {
        content: [{ type: 'text' as const, text: `Exchange rate error: ${err}` }],
        isError: true,
      }
    }
  },
)
