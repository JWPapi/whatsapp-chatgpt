import Anthropic from '@anthropic-ai/sdk'
import * as cli from '../cli/ui.js'

let anthropic

export function initClaude() {
  anthropic = new Anthropic()
  cli.print('[Claude] Anthropic client initialized (claude-opus-4-5-20251101)')
}

// Tool definitions for all bot capabilities
const tools = [
  {
    name: 'web_research',
    description:
      'Search the web for up-to-date information on any topic using Perplexity AI. Use this when the user asks about current events, needs factual information, or wants research on a topic.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The research query or question to search for',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'currency_exchange',
    description:
      'Convert an amount from one currency to another using live exchange rates. Use this when the user asks about currency conversion or exchange rates.',
    input_schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'The amount to convert',
        },
        from_currency: {
          type: 'string',
          description: 'The source currency code (e.g. USD, EUR, GBP)',
        },
        to_currency: {
          type: 'string',
          description: 'The target currency code (e.g. USD, EUR, GBP)',
        },
      },
      required: ['amount', 'from_currency', 'to_currency'],
    },
  },
  {
    name: 'notion_add_todo',
    description:
      'Add a new TODO item to a Notion database. Use this when the user wants to create a task, reminder, or todo item.',
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task description to add',
        },
        user_name: {
          type: 'string',
          description: 'The user to add the todo for (julian or kambiz). If not specified, defaults based on sender.',
          enum: ['julian', 'kambiz'],
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'notion_list_todos',
    description:
      'List all pending TODO items from a Notion database. Use this when the user wants to see their tasks or todo list.',
    input_schema: {
      type: 'object',
      properties: {
        user_name: {
          type: 'string',
          description: 'The user whose todos to list (julian or kambiz). If not specified, defaults based on sender.',
          enum: ['julian', 'kambiz'],
        },
      },
      required: [],
    },
  },
  {
    name: 'send_notification',
    description:
      'Send a push notification via Pushover. Use this when the user wants to set a reminder or send themselves a notification.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The notification message to send',
        },
        title: {
          type: 'string',
          description: 'The notification title (defaults to "Whatsapp Reminder")',
        },
      },
      required: ['message'],
    },
  },
]

// Per-user conversation history for multi-turn context
const conversationHistories = {}

function getConversationHistory(userId) {
  if (!conversationHistories[userId]) {
    conversationHistories[userId] = []
  }
  return conversationHistories[userId]
}

function trimHistory(history, maxMessages = 20) {
  // Keep the last N messages to avoid token overflow
  if (history.length > maxMessages) {
    history.splice(0, history.length - maxMessages)
  }
}

/**
 * Run the Claude agent loop: send message, execute any tool calls, loop until final text response.
 *
 * @param {string} userMessage - The user's text message
 * @param {string} userId - WhatsApp user ID for conversation tracking
 * @param {object} toolContext - Context for tool execution (message object, sender info, etc.)
 * @returns {string} The agent's final text response
 */
export async function runAgent(userMessage, userId, toolContext = {}) {
  const history = getConversationHistory(userId)

  history.push({ role: 'user', content: userMessage })
  trimHistory(history)

  const systemPrompt = `You are a helpful WhatsApp assistant. You have access to tools for web research, currency exchange, Notion todo management, and push notifications.

Key behaviors:
- Be concise and direct — this is WhatsApp, not an essay. Keep responses short.
- Use tools proactively when they're relevant to the user's message.
- For general conversation, just respond naturally without using tools.
- When the user sends a voice transcription (prefixed with 🎤), understand it as their spoken message and respond helpfully.
- If the user mentions a quoted message, consider its context for your response.
- Format responses for WhatsApp: use *bold* for emphasis, avoid markdown headers.`

  let messages = [...history]

  // Agent loop: keep running until we get a final text response (no more tool calls)
  while (true) {
    const start = Date.now()

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    })

    const elapsed = Date.now() - start
    cli.print(`[Claude] API call took ${elapsed}ms (stop_reason: ${response.stop_reason})`)

    // Extract text blocks and tool use blocks
    const textBlocks = response.content.filter(b => b.type === 'text')
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')

    // If no tool calls, we have the final response
    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      const finalText = textBlocks.map(b => b.text).join('\n')

      // Add assistant response to history
      history.push({ role: 'assistant', content: response.content })
      trimHistory(history)

      return finalText
    }

    // Add assistant's response (with tool_use blocks) to messages
    messages.push({ role: 'assistant', content: response.content })

    // Execute all tool calls and collect results
    const toolResults = []
    for (const toolUse of toolUseBlocks) {
      cli.print(`[Claude] Calling tool: ${toolUse.name} with input: ${JSON.stringify(toolUse.input)}`)

      let result
      try {
        result = await executeToolCall(toolUse.name, toolUse.input, toolContext)
        cli.print(`[Claude] Tool ${toolUse.name} succeeded`)
      } catch (error) {
        cli.print(`[Claude] Tool ${toolUse.name} failed: ${error.message}`)
        result = `Error: ${error.message}`
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      })
    }

    // Add tool results to messages and loop back
    messages.push({ role: 'user', content: toolResults })
  }
}

/**
 * Execute a single tool call and return the result string.
 */
async function executeToolCall(toolName, input, context) {
  switch (toolName) {
    case 'web_research':
      return await toolWebResearch(input.query)

    case 'currency_exchange':
      return await toolCurrencyExchange(input.amount, input.from_currency, input.to_currency)

    case 'notion_add_todo':
      return await toolNotionAddTodo(input.task, input.user_name, context)

    case 'notion_list_todos':
      return await toolNotionListTodos(input.user_name, context)

    case 'send_notification':
      return await toolSendNotification(input.message, input.title)

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// ─── Tool Implementations ───────────────────────────────────────────────────

async function toolWebResearch(query) {
  const { perplexity } = await import('./perplexity.js')

  if (!perplexity) {
    throw new Error('Perplexity AI client is not initialized')
  }

  const response = await perplexity.chat.completions.create({
    model: 'sonar-pro',
    messages: [{ role: 'user', content: query }],
  })

  return response.choices[0].message.content
}

async function toolCurrencyExchange(amount, fromCurrency, toCurrency) {
  const exchange = (await import('@abskmj/exchangeratesapi')).default

  const res = await exchange.rates({
    access_key: process.env.EXCHANGE_RATES_API_TOKEN,
    base: 'USD',
  })
  const rates = res.data.rates

  const rateFrom = rates[fromCurrency.toUpperCase()]
  const rateTo = rates[toCurrency.toUpperCase()]

  if (!rateFrom) throw new Error(`Unknown currency: ${fromCurrency}`)
  if (!rateTo) throw new Error(`Unknown currency: ${toCurrency}`)

  const converted = (amount * rateTo) / rateFrom
  return `${amount} ${fromCurrency.toUpperCase()} = ${converted.toFixed(2)} ${toCurrency.toUpperCase()}`
}

async function toolNotionAddTodo(task, userName, context) {
  const { Client } = await import('@notionhq/client')
  const notion = new Client({ auth: process.env.NOTION_TOKEN })

  const db = resolveNotionDb(userName, context.senderId)

  const response = await notion.pages.create({
    parent: { type: 'database_id', database_id: db.id },
    properties: {
      Name: {
        title: [{ text: { content: task } }],
      },
    },
  })

  return `Added to ${db.name}'s To Do: ${task}`
}

async function toolNotionListTodos(userName, context) {
  const { Client } = await import('@notionhq/client')
  const notion = new Client({ auth: process.env.NOTION_TOKEN })

  const db = resolveNotionDb(userName, context.senderId)

  const response = await notion.databases.query({
    database_id: db.id,
    filter: {
      and: [
        { property: 'Status', select: { is_empty: true } },
        { property: 'Is Due', formula: { checkbox: { equals: true } } },
      ],
    },
  })

  const todos = response.results.map(page => page.properties.Name.title[0].plain_text)

  if (todos.length === 0) {
    return `${db.name} has no pending todos.`
  }

  return `*${db.name}'s pending todos:*\n${todos.map(t => `[ ] ${t}`).join('\n')}`
}

function resolveNotionDb(userName, senderId) {
  const jwDatabaseId = 'b430559a3ced44c1bf2b5db8285853c1'
  const kdDatabaseId = 'c13d709df5124795bd977dd019c7bde5'

  if (userName === 'julian') return { id: jwDatabaseId, name: 'Julian' }
  if (userName === 'kambiz') return { id: kdDatabaseId, name: 'Kambiz' }

  // Default based on sender
  const juliansNumbers = ['4915112960532@c.us', '447494047901@c.us']
  if (juliansNumbers.includes(senderId)) return { id: jwDatabaseId, name: 'Julian' }
  if (senderId === '4915140773278@c.us') return { id: kdDatabaseId, name: 'Kambiz' }

  return { id: jwDatabaseId, name: 'Julian' }
}

async function toolSendNotification(message, title) {
  const axios = (await import('axios')).default

  const response = await axios.post('https://api.pushover.net/1/messages.json', {
    token: process.env.PUSHOVER_API_TOKEN,
    user: process.env.PUSHOVER_USER_KEY,
    message,
    title: title || 'Whatsapp Reminder',
  })

  if (response.data && response.data.status === 1) {
    return 'Notification sent successfully.'
  }

  throw new Error(response.data?.errors?.join(', ') || 'Unknown Pushover error')
}

export function resetConversation(userId) {
  delete conversationHistories[userId]
}
