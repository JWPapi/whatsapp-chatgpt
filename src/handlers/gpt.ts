import {randomUUID} from "crypto";
import {Message} from "whatsapp-web.js";
import * as cli from "../cli/ui";
import config from "../config";
import {chatCompletion} from "../providers/openai";

// Moderation
import {moderateIncomingPrompt} from "./moderation";

// Mapping from number to last conversation id
const conversations = {};

const handleMessageGPT = async (message: Message, prompt: string) => {
    try {
        // Get last conversation
        const lastConversationId = conversations[message.from];

        cli.print(`[GPT] Received prompt from ${message.from}: ${prompt}`);


        const start = Date.now();

        // Check if we have a conversation with the user
        let response: string;
        if (lastConversationId) {
            // Handle message with previous conversation
            response = await chatCompletion(prompt)
        } else {
            // Create new conversation
            const convId = randomUUID();

            // Set conversation
            conversations[message.from] = convId;

            cli.print(`[GPT] New conversation for ${message.from} (ID: ${convId})`);

            // Handle message with new conversation
            response = await chatCompletion(prompt)
        }

        const end = Date.now() - start;

        cli.print(`[GPT] Answer to ${message.from}: ${response}  | OpenAI request took ${end}ms)`);

        // Default: Text reply
        message.reply(response);
    } catch (error: any) {
        console.error("An error occured", error);
        message.reply("An error occured, please contact the administrator. (" + error.message + ")");
    }
};

const handleDeleteConversation = async (message: Message) => {
    // Delete conversation
    delete conversations[message.from];

    // Reply
    message.reply("Conversation context was reset!");
};

export {handleMessageGPT, handleDeleteConversation};
