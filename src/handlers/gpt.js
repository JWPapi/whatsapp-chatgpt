import { randomUUID } from "crypto";
import * as cli from "../cli/ui.js";
import { chatCompletion } from "../providers/openai.js";
import { safeReply } from "../utils.js";

const conversations = {};

export const handleMessageGPT = async (message, prompt) => {
	try {
		const lastConversationId = conversations[message.from];

		cli.print(`[GPT] Received prompt from ${message.from}: ${prompt}`);

		const start = Date.now();

		let response;
		if (lastConversationId) {
			response = await chatCompletion(prompt);
		} else {
			const convId = randomUUID();

			conversations[message.from] = convId;

			cli.print(`[GPT] New conversation for ${message.from} (ID: ${convId})`);

			response = await chatCompletion(prompt);
		}

		const end = Date.now() - start;

		cli.print(`[GPT] Answer to ${message.from}: ${response}  | OpenAI request took ${end}ms)`);

		await safeReply(message, response);
	} catch (error) {
		console.error("An error occured", error);
		await safeReply(message, "An error occured, please contact the administrator. (" + error.message + ")");
	}
};
