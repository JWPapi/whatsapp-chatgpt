import { query, createSdkMcpServer, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk'
import { safeReply, safeReplyMedia, getChatId, chunkMessage } from './utils.js'
import * as cli from './cli/ui.js'
import config from './config.js'
import type { Message, DocumentAction } from './types.js'
import { uploadToCloud } from './providers/cloud-storage.js'

// Document MCP server
import { documentServer, documentToolNames } from './mcp/document-server.js'

// Custom tools (imported statically, registered conditionally)
import { currencyExchangeTool } from './tools/exchange.js'
import { createGithubIssueTool } from './tools/github-issue.js'

// ============================================================================
// Startup: check which features are available
// ============================================================================

export function logAvailableFeatures(): void {
  const features: string[] = []
  const missing: string[] = []

  if (process.env.ANTHROPIC_API_KEY) {
    features.push('Agent (Claude)')
  } else {
    missing.push('ANTHROPIC_API_KEY — agent/chat disabled')
  }

  if (process.env.OPENAI_API_KEY) {
    features.push('Transcription (Whisper)')
  } else {
    missing.push('OPENAI_API_KEY — voice transcription disabled')
  }

  if (process.env.EXCHANGE_RATES_API_TOKEN) {
    features.push('Currency exchange')
  } else {
    missing.push('EXCHANGE_RATES_API_TOKEN — currency exchange tool disabled')
  }

  if (process.env.NOTION_TOKEN) {
    features.push('Notion')
  } else {
    missing.push('NOTION_TOKEN — Notion integration disabled')
  }

  if (process.env.GITHUB_TOKEN) {
    features.push('GitHub (issue creation → @claude)')
  } else {
    missing.push('GITHUB_TOKEN — GitHub issue creation disabled')
  }

  if (config.documentGenerationEnabled) {
    features.push('Document generation')
  }

  features.push('YouTube transcripts')

  if (config.vercelBlobToken) {
    features.push('Cloud upload (Vercel Blob)')
  }

  cli.print('[Startup] Enabled features: ' + (features.length > 0 ? features.join(', ') : 'none'))
  if (missing.length > 0) {
    for (const m of missing) {
      cli.print(`[Startup] Missing: ${m}`)
    }
  }
}

// ============================================================================
// Conversation history
// ============================================================================

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const conversationHistory = new Map<string, ConversationMessage[]>()
const HISTORY_MAX_MESSAGES = 20
const HISTORY_EXPIRY_MS = 30 * 60 * 1000

function getConversationContext(chatId: string): string {
  const history = conversationHistory.get(chatId) || []
  const now = Date.now()
  const validHistory = history.filter(msg => now - msg.timestamp < HISTORY_EXPIRY_MS)

  if (validHistory.length === 0) return ''

  const formatted = validHistory
    .slice(-10)
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n\n')

  return `\n\n--- Previous conversation ---\n${formatted}\n--- End of history ---\n\n`
}

function addToHistory(chatId: string, role: 'user' | 'assistant', content: string): void {
  const history = conversationHistory.get(chatId) || []
  history.push({ role, content: content.substring(0, 500), timestamp: Date.now() })
  if (history.length > HISTORY_MAX_MESSAGES) history.shift()
  conversationHistory.set(chatId, history)
}

setInterval(() => {
  const now = Date.now()
  for (const [chatId, history] of conversationHistory.entries()) {
    const valid = history.filter(msg => now - msg.timestamp < HISTORY_EXPIRY_MS)
    if (valid.length === 0) conversationHistory.delete(chatId)
    else conversationHistory.set(chatId, valid)
  }
}, 5 * 60 * 1000)

// ============================================================================
// User context
// ============================================================================

function getUserContext(message: Message): string {
  const juliansNumbers = ['4915112960532@c.us', '447494047901@c.us']
  const kambizNumber = '4915140773278@c.us'

  if (juliansNumbers.includes(message.from)) return 'The user is Julian Wagner.'
  if (message.from === kambizNumber) return 'The user is Kambiz Djalali.'
  return `The user's phone: ${message.from}`
}

// ============================================================================
// MCP servers (built lazily, only includes what has keys)
// ============================================================================

function buildMcpServers(): Record<string, any> {
  const servers: Record<string, any> = {}

  if (config.documentGenerationEnabled) {
    servers['documents'] = documentServer
  }

  if (process.env.NOTION_TOKEN) {
    servers['notion'] = {
      command: 'npx',
      args: ['-y', '@notionhq/notion-mcp-server'],
      env: {
        OPENAPI_MCP_HEADERS: JSON.stringify({
          Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
        }),
      },
    }
  }

  // YouTube transcripts - always enabled, no API key needed
  servers['youtube'] = {
    command: 'npx',
    args: ['-y', '@kimtaeyoon83/mcp-server-youtube-transcript'],
  }

  return servers
}

// ============================================================================
// Custom tools (built lazily, only includes what has keys)
// ============================================================================

let _customToolsServer: ReturnType<typeof createSdkMcpServer> | null = null

function getCustomToolsServer(): ReturnType<typeof createSdkMcpServer> {
  if (_customToolsServer) return _customToolsServer

  const tools: SdkMcpToolDefinition<any>[] = []

  if (process.env.EXCHANGE_RATES_API_TOKEN) {
    tools.push(currencyExchangeTool)
  }

  if (process.env.GITHUB_TOKEN) {
    tools.push(createGithubIssueTool)
  }

  _customToolsServer = createSdkMcpServer({
    name: 'custom-tools',
    version: '1.0.0',
    tools,
  })

  return _customToolsServer
}

// ============================================================================
// Allowed tools list
// ============================================================================

function buildAllowedTools(): string[] {
  const tools = ['WebSearch', 'WebFetch']

  const customTools = getCustomToolsServer()
  // Only add custom-tools wildcard if we have any tools registered
  if (customTools) tools.push('mcp__custom-tools__*')

  if (config.documentGenerationEnabled) tools.push(...documentToolNames)
  if (process.env.NOTION_TOKEN) tools.push('mcp__notion__*')
  tools.push('mcp__youtube__*')

  return tools
}

// ============================================================================
// System prompt
// ============================================================================

function buildSystemPrompt(message: Message, chatId: string): string {
  const userContext = getUserContext(message)
  const conversationContext = getConversationContext(chatId)

  const capabilities: string[] = [
    '- *Web Search & Fetch*: Search the web or fetch specific URLs for current information',
  ]
  if (process.env.EXCHANGE_RATES_API_TOKEN) {
    capabilities.push('- *Currency Exchange*: Convert between currencies with live rates')
  }
  if (config.documentGenerationEnabled) {
    capabilities.push(
      '- *Document Generation*: Create PDFs, Excel spreadsheets, and PowerPoint presentations (via document tools)',
    )
  }
  if (process.env.NOTION_TOKEN) {
    capabilities.push(
      '- *Notion*: Full access to Notion workspace — search, create, update pages and databases',
    )
  }
  if (process.env.GITHUB_TOKEN) {
    capabilities.push(
      '- *GitHub*: Create issues on GitHub repos with @claude to trigger autonomous coding. Use this for bug fixes, features, and refactoring tasks.',
    )
  }

  capabilities.push(
    '- *YouTube Transcripts*: Fetch transcripts from YouTube videos for summarization or Q&A',
  )

  let prompt = `You are Jarvis, a helpful personal assistant responding via WhatsApp.

${userContext}

## Response Format
- Keep responses concise and well-formatted for mobile reading
- Use WhatsApp formatting: *bold*, _italic_, ~strikethrough~, \`code\`
- Use - for bullet lists
- Avoid code blocks unless specifically asked for code
- Maximum message length is ~4000 characters; for longer content, be concise or use document generation

## Available Capabilities
You have many tools available. Use them naturally based on what the user asks:

${capabilities.join('\n')}

## Tool Usage Notes
- For document generation, use the MCP document tools (generate_pdf, generate_excel, generate_powerpoint)
- For Notion tasks/todos, use the Notion MCP tools to find and create pages

## Conversation Memory
You have memory of the conversation. If the user refers to something mentioned earlier, use the context provided.`

  if (conversationContext) {
    prompt += conversationContext
  }

  return prompt
}

// ============================================================================
// Document delivery
// ============================================================================

async function deliverDocument(message: Message, doc: DocumentAction): Promise<void> {
  cli.print(`[Agent] Document: ${doc.filename} (${(doc.size / 1024).toFixed(1)} KB)`)

  if (doc.size <= config.documentSizeThresholdBytes) {
    await safeReplyMedia(
      message,
      { base64: doc.base64, mimetype: doc.mimetype, filename: doc.filename },
      { caption: doc.caption },
    )
  } else {
    if (!config.vercelBlobToken) {
      await safeReply(message, `Document "${doc.filename}" is too large. Cloud upload not configured.`)
      return
    }
    try {
      const uploadResult = await uploadToCloud(doc.base64, doc.filename, doc.mimetype)
      const captionText = doc.caption ? `${doc.caption}\n\n` : ''
      await safeReply(message, `${captionText}*${doc.filename}*\nDownload: ${uploadResult.downloadUrl}`)
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      await safeReply(message, `Failed to upload document: ${err}`)
    }
  }
}

function extractDocumentAction(text: string): DocumentAction | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed._action === 'send_document' && parsed.base64) return parsed as DocumentAction
  } catch {
    const jsonMatch = text.match(/\{[^{}]*"_action"\s*:\s*"send_document"[^{}]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.base64) return parsed as DocumentAction
      } catch {
        // ignore
      }
    }
  }
  return null
}

// ============================================================================
// Public API
// ============================================================================

/** Whether the agent is available (has Anthropic key) */
export function isAgentAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

/** Main handler — called for all messages that should go to the agent */
export async function handleMessage(message: Message, prompt: string, chatId: string): Promise<void> {
  if (!prompt?.trim()) {
    await safeReply(message, "Hey! I'm listening. What can I help you with?")
    return
  }

  if (!isAgentAvailable()) {
    cli.print('[Agent] Skipping — ANTHROPIC_API_KEY not configured')
    return
  }

  cli.print(
    `[Agent] Processing for ${chatId.slice(-4)}: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
  )

  addToHistory(chatId, 'user', prompt)

  try {
    let result = ''
    let hasError = false
    let errorDetails = ''

    const mcpServers = buildMcpServers()
    mcpServers['custom-tools'] = getCustomToolsServer()

    const systemPrompt = buildSystemPrompt(message, chatId)
    const allowedTools = buildAllowedTools()

    for await (const msg of query({
      prompt: prompt.trim(),
      options: {
        model: 'claude-opus-4-5',
        allowedTools,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        systemPrompt,
        maxTurns: 15,
        mcpServers,
        persistSession: false,
      },
    })) {
      if ('type' in msg) {
        cli.print(`[Agent] Message type: ${msg.type}`)
      }

      if ('result' in msg && typeof msg.result === 'string') {
        result = msg.result
      }

      if ('is_error' in msg && msg.is_error) {
        hasError = true
        if ('errors' in msg && Array.isArray(msg.errors)) {
          errorDetails = msg.errors.join(', ')
        }
      }
    }

    if (hasError && errorDetails) {
      cli.print(`[Agent] Error: ${errorDetails}`)
      await safeReply(message, `Error: ${errorDetails}`)
      return
    }

    if (!result) {
      await safeReply(message, 'No response generated. Please try again.')
      return
    }

    cli.print(`[Agent] Result (first 200 chars): ${result.substring(0, 200)}`)
    addToHistory(chatId, 'assistant', result)

    const docAction = extractDocumentAction(result)
    if (docAction) {
      await deliverDocument(message, docAction)
      const cleanText = result
        .replace(/\{[^{}]*"_action"\s*:\s*"send_document"[^{}]*\}/, '')
        .trim()
      if (cleanText) {
        const chunks = chunkMessage(cleanText)
        for (const chunk of chunks) await safeReply(message, chunk)
      }
      return
    }

    const chunks = chunkMessage(result)
    cli.print(`[Agent] Sending ${chunks.length} message(s)`)
    for (const chunk of chunks) await safeReply(message, chunk)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    let userMessage = errorMessage.length > 200 ? errorMessage.substring(0, 200) + '...' : errorMessage

    if (errorMessage.includes('API key')) userMessage = 'Invalid or missing API key.'
    else if (errorMessage.includes('rate limit')) userMessage = 'Rate limit exceeded. Please wait.'
    else if (errorMessage.includes('process exited')) userMessage = 'Agent process failed.'

    cli.print(`[Agent] Error: ${errorMessage}`)
    await safeReply(message, `Error: ${userMessage}`)
  }
}

/** Evaluate whether to respond to non-prefixed messages (cheap gate with Sonnet) */
export async function evaluateMessage(
  message: Message,
  prompt: string,
  chatId: string,
): Promise<boolean> {
  if (!prompt?.trim() || !isAgentAvailable()) return false

  cli.print(`[Jarvis] Evaluating: "${prompt.substring(0, 40)}..."`)

  addToHistory(chatId, 'user', prompt)

  try {
    let result = ''
    const conversationContext = getConversationContext(chatId)

    const systemPrompt = `You are Jarvis, a helpful assistant in a WhatsApp chat. Your DEFAULT is to NOT respond. Output exactly "NO_RESPONSE" unless you are very confident the message is meant for you.

ONLY respond when ALL of these are true:
- The message explicitly mentions you by name ("Jarvis"), OR is a direct reply to something you JUST said in the last 1-2 messages
- The message clearly expects a response from you (a question, a request, or a direct follow-up)

ALWAYS output "NO_RESPONSE" when:
- The message doesn't mention you by name and isn't a direct follow-up to your last message
- People are having a conversation with each other
- It's small talk, acknowledgements ("ok", "thanks", "cool", "haha", "lol"), reactions, or casual chatter
- Someone asks a question but is clearly asking another person, not you
- You're unsure whether the message is directed at you — when in doubt, do NOT respond
- The message is a general statement, opinion, or thought not directed at anyone specific

When you DO respond, be concise and helpful. Format for WhatsApp (*bold*, - lists).
If you don't respond, output exactly: NO_RESPONSE

${conversationContext}`

    for await (const msg of query({
      prompt: prompt.trim(),
      options: {
        model: 'claude-sonnet-4-20250514',
        allowedTools: ['WebSearch', 'WebFetch'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        systemPrompt,
        maxTurns: 3,
        persistSession: false,
      },
    })) {
      if ('result' in msg && typeof msg.result === 'string') {
        result = msg.result
      }
    }

    if (!result || result.trim() === 'NO_RESPONSE' || result.trim().startsWith('NO_RESPONSE')) {
      return false
    }

    await handleMessage(message, prompt, chatId)
    return true
  } catch (error) {
    cli.print(`[Jarvis] Evaluation error: ${error}`)
    return false
  }
}
