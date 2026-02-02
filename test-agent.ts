/**
 * Test the agent with mock WhatsApp messages.
 * Captures all replies instead of sending to WhatsApp.
 *
 * Usage: npx vite-node test-agent.ts
 */

import { handleMessage, evaluateMessage } from './src/agent.js'

// Collect all replies
const replies: string[] = []
const mediaReplies: { filename: string; mimetype: string; size: number; caption?: string }[] = []

// Mock WhatsApp message
function mockMessage(text: string, from = '4915112960532@c.us'): any {
  return {
    body: text,
    from,
    hasMedia: false,
    hasQuotedMsg: false,
    timestamp: Math.floor(Date.now() / 1000),
    reply: async (content: any) => {
      if (typeof content === 'string') {
        replies.push(content)
      } else {
        // MessageMedia
        mediaReplies.push({
          filename: content.filename || 'unknown',
          mimetype: content.mimetype || 'unknown',
          size: content.data?.length || 0,
        })
      }
      return {} as any
    },
    getChat: async () => ({ isGroup: false, name: 'Test Chat' }),
  }
}

function clearReplies() {
  replies.length = 0
  mediaReplies.length = 0
}

function printResults(testName: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TEST: ${testName}`)
  console.log('='.repeat(60))
  if (replies.length > 0) {
    for (const reply of replies) {
      console.log(`\n💬 Reply:\n${reply}`)
    }
  }
  if (mediaReplies.length > 0) {
    for (const media of mediaReplies) {
      console.log(`\n📎 Media: ${media.filename} (${media.mimetype})`)
    }
  }
  if (replies.length === 0 && mediaReplies.length === 0) {
    console.log('\n(no replies)')
  }
}

// Test cases
async function runTests() {
  const chatId = 'test-chat-001@c.us'

  // Test 1: Simple greeting
  console.log('\n🧪 Running Test 1: Simple question...')
  clearReplies()
  await handleMessage(mockMessage('What is 2 + 2?'), 'What is 2 + 2?', chatId)
  printResults('Simple question (2+2)')

  // Test 2: Currency exchange (should use tool)
  console.log('\n🧪 Running Test 2: Currency exchange...')
  clearReplies()
  await handleMessage(
    mockMessage('Convert 100 USD to EUR'),
    'Convert 100 USD to EUR',
    chatId,
  )
  printResults('Currency exchange')

  // Test 3: Web search
  console.log('\n🧪 Running Test 3: Web search...')
  clearReplies()
  await handleMessage(
    mockMessage('What is the current weather in Berlin?'),
    'What is the current weather in Berlin?',
    chatId,
  )
  printResults('Web search (weather)')

  // Test 4: Conversation memory
  console.log('\n🧪 Running Test 4: Conversation memory...')
  clearReplies()
  await handleMessage(mockMessage('My favorite color is blue'), 'My favorite color is blue', chatId)
  printResults('Memory setup')

  clearReplies()
  await handleMessage(mockMessage('What is my favorite color?'), 'What is my favorite color?', chatId)
  printResults('Memory recall')

  // Test 5: evaluateMessage — should NOT respond to small talk
  console.log('\n🧪 Running Test 5: Evaluate gate (should ignore)...')
  clearReplies()
  const responded = await evaluateMessage(mockMessage('ok cool'), 'ok cool', 'other-chat@c.us')
  console.log(`\n${'='.repeat(60)}`)
  console.log('TEST: Evaluate gate (small talk)')
  console.log('='.repeat(60))
  console.log(`\nResponded: ${responded}`)
  if (replies.length > 0) {
    for (const reply of replies) console.log(`💬 Reply: ${reply}`)
  }

  // Test 6: evaluateMessage — SHOULD respond to direct question
  console.log('\n🧪 Running Test 6: Evaluate gate (should respond)...')
  clearReplies()
  const responded2 = await evaluateMessage(
    mockMessage('Hey Jarvis, what time is it?'),
    'Hey Jarvis, what time is it?',
    'other-chat@c.us',
  )
  console.log(`\n${'='.repeat(60)}`)
  console.log('TEST: Evaluate gate (direct question)')
  console.log('='.repeat(60))
  console.log(`\nResponded: ${responded2}`)
  if (replies.length > 0) {
    for (const reply of replies) console.log(`💬 Reply: ${reply}`)
  }

  console.log('\n\n✅ All tests completed.')
  process.exit(0)
}

runTests().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
