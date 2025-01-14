import {Message} from "whatsapp-web.js";
import {startsWithIgnoreCase} from "../utils";

// Config & Constants
import config from "../config";

// CLI
import * as cli from "../cli/ui";

// ChatGPT & DALLE
import { handleMessageGPT} from "./gpt";
import {handleMessageDALLE} from "./dalle";
import {getConfig} from "./ai-config";

// Speech API & Whisper
import {transcribeOpenAI} from "../providers/openai";

// For deciding to ignore old messages
import {botReadyTimestamp} from "../index";
import {handleMessageNotion} from "./notion";
import {handleMessageResearch} from "./handleMessageResearch";

const TODO_KEYWORDS = ['todo','to do', 'to-do']

// @ts-ignore
// Handles message
async function handleIncomingMessage(message: Message) {
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
            return
        }
    }

    // Prevent handling old messages
    if (message.timestamp != null) {
        const messageTimestamp = new Date(message.timestamp * 1000);

        // If startTimestamp is null, the bot is not ready yet
        if (botReadyTimestamp == null) {
            cli.print("Ignoring message because bot is not ready yet: " + messageString);
            return;
        }

        // Ignore messages that are sent before the bot is started
        if (messageTimestamp < botReadyTimestamp) {
            cli.print("Ignoring old message: " + messageString);
            return;
        }
    }

    // Ignore groupchats if disabled
    if ((await message.getChat()).isGroup && !config.groupchatsEnabled) return;

    const selfNotedMessage = message.fromMe && message.hasQuotedMsg === false && message.from === message.to;

    // Transcribe audio
    if (message.hasMedia) {
        const media = await message.downloadMedia();

        // Ignore non-audio media
        if (!media || !media.mimetype.startsWith("audio/")) {
            console.log('non audio media')
            return
        }

        // Check if transcription is enabled (Default: false)
        if (!getConfig("transcription", "enabled")) {
            cli.print("[Transcription] Received voice messsage but voice transcription is disabled.");
            return;
        }

        // Convert media to base64 string
        const mediaBuffer = Buffer.from(media.data, "base64");

        // Transcribe locally or with Speech API
        const transcriptionMode = getConfig("transcription", "mode");
        cli.print(`[Transcription] Transcribing audio with "${transcriptionMode}" mode...`);

        const res = await transcribeOpenAI(mediaBuffer);

        const {text: transcribedText, language: transcribedLanguage} = res;

        // Check transcription is null (error)
        if (transcribedText == null) {
            message.reply("I couldn't understand what you said.");
            return;
        }

        // Check transcription is empty (silent voice message)
        if (transcribedText.length == 0) {
            message.reply("I couldn't understand what you said.");
            return;
        }

        // Log transcription
        cli.print(`[Transcription] Transcription response: ${transcribedText} (language: ${transcribedLanguage})`);

        // Reply with transcription
        const reply = `${transcribedText}${transcribedLanguage ? " (language: " + transcribedLanguage + ")" : ""}`;
        message.reply(reply);

        // Handle message GPT
        return;
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

export {handleIncomingMessage};