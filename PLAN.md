# Code Cleanup Plan

## Phase 1: Extract Common Utilities (COMPLETED)

### Changes Made

1. **Moved `chunkMessage()` to `utils.ts`**
   - Removed duplicate implementations from `handleAgent.ts` and `handleClaudeCode.ts`
   - Added `WHATSAPP_MAX_LENGTH` constant (4000 chars)
   - Saved ~60 lines of duplicated code

2. **Centralized `getChatId()` in `utils.ts`**
   - Removed duplicate implementations from `message.ts` and `handleAgent.ts`
   - Single source of truth for extracting chat ID from messages
   - Saved ~9 lines of duplicated code

3. **Fixed typo "occured" to "occurred"**
   - Fixed in: `gpt.ts`, `handleMessageResearch.ts`, `handleExchangeCalculation.ts`, `handle-message-remind.ts`

4. **Fixed `handle-message-remind.ts` to use `safeReply`**
   - Replaced direct `message.reply()` with `safeReply()` for consistent error handling

---

## Phase 2: Standardize Patterns (COMPLETED)

### Changes Made

1. **Renamed handlers consistently**
   - `handle-message-remind.ts` → `handleRemind.ts`
   - `gpt.ts` → `handleGpt.ts`
   - `notion.ts` → `handleNotion.ts`
   - Updated import in `message.ts`

2. **Standardized logging**
   - Replaced all `console.log/error` with `cli.print()` in handlers
   - Files updated: `handleExchangeCalculation.ts`, `handleMessageResearch.ts`, `handleGpt.ts`, `handleRemind.ts`, `handleNotion.ts`, `message.ts`
   - All handlers now use consistent `[HandlerName]` prefix format

3. **Fixed additional typo in `handleNotion.ts`**
   - Changed "occured" to "occurred"

---

## Files Modified in Phase 2

- `src/handlers/handle-message-remind.ts` → `src/handlers/handleRemind.ts`
- `src/handlers/gpt.ts` → `src/handlers/handleGpt.ts`
- `src/handlers/notion.ts` → `src/handlers/handleNotion.ts`
- `src/handlers/message.ts` - Updated import, replaced console.log
- `src/handlers/handleExchangeCalculation.ts` - Replaced console.log/error with cli.print
- `src/handlers/handleMessageResearch.ts` - Replaced console.log/error with cli.print
- `src/handlers/handleNotion.ts` - Replaced console.error with cli.print, fixed typo

---

## Phase 3: Handler Registry Pattern (COMPLETED)

### Changes Made

1. **Created `src/handlers/registry.ts`**
   - `MessageHandler` interface with name, test, handle, priority, enabled
   - `registerHandler()` function for adding handlers
   - `dispatchToHandler()` function for routing messages
   - Support for conditional handlers (return boolean)
   - Priority-based ordering

2. **Registered handlers:**
   - `order` (priority 10) - Zinc ordering, conditional
   - `exchange` (priority 20) - Currency conversion
   - `claude-code` (priority 30) - Claude Code CLI
   - `todo` (priority 40) - Notion todos

3. **Refactored `message.ts`**
   - Clear separation of concerns with helper functions
   - `handleQuotedMessage()` - summarize, action, research, todo
   - `handleMediaMessage()` - audio transcription
   - `handleJarvisConversation()` - Jarvis conversation state
   - Main handler now has clear numbered flow:
     1. Quoted messages
     2. Timestamp validation
     3. Group chat filtering
     4. Media handling
     5. Registry dispatch
     6. Jarvis fallback

### Adding New Handlers

To add a new handler, simply register it in `registry.ts`:

```typescript
import { myHandler } from './myHandler.js'

registerHandler({
  name: 'my-handler',
  priority: 25,
  enabled: () => config.myFeatureEnabled,
  test: (text) => text.startsWith('!mycommand'),
  extractPrompt: (text) => text.substring(10),
  handle: myHandler,
})
```

---

## Files Modified in Phase 3

- `src/handlers/registry.ts` - NEW: Handler registry system
- `src/handlers/message.ts` - Refactored to use registry, cleaner structure

---

## Phase 4: Provider Unification (COMPLETED)

### Changes Made

1. **Converted to lazy initialization**
   - `openai.ts` - Removed `initOpenAI()`, uses `getClient()` pattern
   - `perplexity.ts` - Removed `initPerplexity()`, uses `getPerplexityClient()` function
   - Providers initialize on first use, no explicit init calls needed

2. **Standardized logging**
   - All providers now use `cli.print()` with `[ProviderName]` prefix
   - Removed all `console.log/error` from providers

3. **Unified configuration access**
   - Added `perplexityApiKey`, `pushoverUserKey`, `pushoverApiToken` to config
   - All providers now read from `config` module
   - No more direct `process.env` access in providers

4. **Cleaned up index.ts**
   - Removed `initOpenAI()` and `initPerplexity()` imports and calls
   - Comment noting lazy initialization pattern

---

## Files Modified in Phase 4

- `src/types.ts` - Added perplexityApiKey, pushoverUserKey, pushoverApiToken to Config
- `src/config.ts` - Added new config values
- `src/providers/openai.ts` - Lazy init, cli.print logging
- `src/providers/perplexity.ts` - Lazy init, config module, cli.print logging
- `src/providers/pushover.ts` - Config module, cli.print logging
- `src/providers/zinc.ts` - Added cli.print for error logging
- `src/handlers/handleMessageResearch.ts` - Updated to use getPerplexityClient()
- `src/index.ts` - Removed init calls

---

## Files Modified in Phase 1

- `src/utils.ts` - Added `chunkMessage()`, `getChatId()`, `WHATSAPP_MAX_LENGTH`
- `src/handlers/handleAgent.ts` - Import from utils, removed local implementations
- `src/handlers/handleClaudeCode.ts` - Import from utils, removed local implementation
- `src/handlers/message.ts` - Import getChatId from utils, removed local implementation
- `src/handlers/gpt.ts` - Fixed typo
- `src/handlers/handleMessageResearch.ts` - Fixed typo
- `src/handlers/handleExchangeCalculation.ts` - Fixed typo
- `src/handlers/handle-message-remind.ts` - Fixed typo, use safeReply
