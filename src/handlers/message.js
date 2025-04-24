const { Message } = require("whatsapp-web.js"); // Assuming Message is needed, otherwise remove
const { startsWithIgnoreCase } = require("../utils"); // Assuming utils.js exports this

// Config & Constants
const config = require("../config"); // Assuming config.js exports default or config object
const constants = require("../constants"); // Assuming constants.js exports the constants object

// CLI
const cli = require("../cli/ui"); // Assuming ui.js exports functions

// Handlers & Providers
const { handleMessageGPT } = require("./gpt"); // Assuming gpt.js exports this
const { handleMessageDALLE } = require("./dalle"); // Assuming dalle.js exports this
const { getConfig } = require("./ai-config"); // Assuming ai-config.js exports this
const { transcribeOpenAI } = require("../providers/openai"); // Assuming openai.js exports this
const { handleMessageNotion } = require("./notion"); // Assuming notion.js exports this
const { handleMessageResearch } = require("./handleMessageResearch"); // Assuming handleMessageResearch.js exports this

// For deciding to ignore old messages
// Note: botReadyTimestamp is tricky to import directly due to circular dependencies potential
// It's better if index.js passes this state down or uses an event emitter/shared state module.
// For now, we'll require index.js, but this might need refactoring.
const { botReadyTimestamp } = require("../index");

const TODO_KEYWORDS = ['todo', 'to do', 'to-do'];

// Handles message
async function handleIncomingMessage(message) { // Removed : Message type
    let messageString = message.body;

    if (message.hasQuotedMsg) {
        let {body} = message;
        const quotedMessage = message._data.quotedMsg.body;

        body = body.toLowerCase().trim();


        if (body === 'summarize') {
            const prompt = `Please summare this text: ${quotedMessage}`
            await handleMessageGPT(message, prompt);
            return
        }
        if (body === 'action') {
            const prompt = `Generate list of reasonable-sized action items, based on this message. Don’t overcomplicate stuff. Focus on the important tasks. Rather less than more. Only respond with the list.: ${quotedMessage}`
            await handleMessageGPT(message, prompt);
            return
        }
        if (TODO_KEYWORDS.includes(body)) {
            await handleMessageNotion(message, quotedMessage);
            return;
        }
    }

    // Prevent handling old messages (moved check higher for efficiency)
	if (message.timestamp != null && botReadyTimestamp != null) {
		const messageTimestamp = new Date(message.timestamp * 1000);
		// Ignore messages that are sent before the bot is started
		if (messageTimestamp < botReadyTimestamp) {
			cli.print(`Ignoring old message: ${messageString || "[Media Message]"}`);
			return;
		}
	} else if (botReadyTimestamp == null) {
        // Bot is not ready yet, ignore message
        cli.print(`Ignoring message because bot is not ready yet: ${messageString || "[Media Message]"}`);
        return;
    }

    // Ignore groupchats if disabled (moved check higher for efficiency)
	const chat = await message.getChat();
	if (chat.isGroup && !config.groupchatsEnabled) {
        cli.print(`Ignoring message from group chat ${chat.name} as group chats are disabled.`);
        return;
    }

    const selfNotedMessage = message.fromMe && !message.hasQuotedMsg && message.from === message.to;

    // Transcribe audio
    if (message.hasMedia) {
        const media = await message.downloadMedia();

        // Ignore non-audio media
        if (!media || !media.mimetype.startsWith("audio/")) {
            console.log('non audio media')
            return
        }

        // Check if transcription is enabled (using config directly now)
        if (config.transcriptionMode === 'disabled') { // Assuming 'disabled' is a valid value in TranscriptionMode object
            cli.print("[Transcription] Received voice message but voice transcription is disabled.");
            return;
        }

        // Convert media to base64 string
        const mediaBuffer = Buffer.from(media.data, "base64");

        // Transcribe using the configured mode (currently hardcoded to openai in the check above)
        cli.print(`[Transcription] Transcribing audio with "${config.transcriptionMode}" ...`);

        // Assuming only OpenAI is implemented based on the check above
        const res = await transcribeOpenAI(mediaBuffer);

        const { text: transcribedText, language: transcribedLanguage } = res || {}; // Add default empty object for safety

        // Check transcription is null or empty (error or silent voice message)
        if (!transcribedText) {
            message.reply("I couldn't understand what you said.");
            return;
        }

        // Log transcription
        cli.print(`[Transcription] Transcription response: ${transcribedText} (language: ${transcribedLanguage || 'unknown'})`);

        // Reply with transcription
        const reply = `${transcribedText}${transcribedLanguage ? ` (language: ${transcribedLanguage})` : ""}`;
        message.reply(reply);

        // Decide if the transcribed text should be processed further (e.g., by GPT)
        // For now, we just reply and return. Uncomment below to process with GPT.
        // messageString = transcribedText; // Update messageString to be the transcribed text
        return; // Stop processing after transcription reply
    }


    // GPT (!gpt <prompt>)
    if (startsWithIgnoreCase(messageString, config.gptPrefix)) {
        const prompt = messageString.substring(config.gptPrefix.length + 1);
        await handleMessageGPT(message, prompt);
        return;
    }

    // DALLE (!dalle <prompt>)
    if (startsWithIgnoreCase(messageString, config.dallePrefix)) {
        const prompt = messageString.substring(config.dallePrefix.length + 1);
        await handleMessageDALLE(message, prompt);
        return;
    }

    // GPT (only <prompt>)
    if (!config.prefixEnabled || (config.prefixSkippedForMe && selfNotedMessage)) {
        await handleMessageGPT(message, messageString);
        return;
    }

    // Notion (!notion <prompt>)
    if (TODO_KEYWORDS.some(keyword => startsWithIgnoreCase(messageString, keyword))) {
        const prompt = messageString.substring(5);
        await handleMessageNotion(message, prompt);
        return;
    }

    if (startsWithIgnoreCase(messageString, 'research')) {
        await handleMessageResearch(message, messageString);
        return;
    }

}

module.exports = { handleIncomingMessage };
