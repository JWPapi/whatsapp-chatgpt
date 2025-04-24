import { randomUUID } from "crypto";
// const { Message } = require("whatsapp-web.js"); // Message type often not needed in JS
import * as cli from "../cli/ui.js";
import * as config from "../config.js";
import { chatCompletion } from "../providers/openai.js";

// Moderation - Assuming moderation.js exports this function

// Mapping from number to last conversation id
const conversations = {}; // Simple in-memory store, might need persistence

export const handleMessageGPT = async (message, prompt) => {
	// Removed : Message, : string types
	try {
		// Get last conversation
		const lastConversationId = conversations[message.from];

		cli.print(`[GPT] Received prompt from ${message.from}: ${prompt}`);

		const start = Date.now();

		// Check if we have a conversation with the user
		let response; // Removed : string type
		if (lastConversationId) {
			// TODO: Pass conversation context if chatCompletion supports it
			response = await chatCompletion(prompt);
		} else {
			// Create new conversation
			const convId = randomUUID();

			// Set conversation
			conversations[message.from] = convId;

			cli.print(`[GPT] New conversation for ${message.from} (ID: ${convId})`);

			// TODO: Pass conversation context if chatCompletion supports it
			response = await chatCompletion(prompt);
		}

		const end = Date.now() - start;

		cli.print(`[GPT] Answer to ${message.from}: ${response}  | OpenAI request took ${end}ms)`);

		// Default: Text reply
		message.reply(response);
	} catch (error) {
		console.error("An error occured", error);
		message.reply("An error occured, please contact the administrator. (" + error.message + ")");
	}
};
