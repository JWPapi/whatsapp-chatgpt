const { MessageMedia } = require("whatsapp-web.js");
// Use the exported getter function for openai instance
const { openai: getOpenaiInstance } = require("../providers/openai");
const config = require("../config");
const cli = require("../cli/ui");

// Moderation - Assuming moderation.js exports this function
const { moderateIncomingPrompt } = require("./moderation");

const handleMessageDALLE = async (message, prompt) => { // Removed : any types
	try {
		const start = Date.now();

		cli.print(`[DALL-E] Received prompt from ${message.from}: ${prompt}`);

		// Prompt Moderation
		if (config.promptModerationEnabled) {
			try {
				await moderateIncomingPrompt(prompt);
			} catch (error: any) {
				message.reply(error.message);
				return;
			}
		}

		// Get the initialized OpenAI client instance
		const openai = getOpenaiInstance();
		if (!openai) {
			message.reply("Error: OpenAI client is not initialized.");
			console.error("[DALL-E] OpenAI client not initialized.");
			return;
		}

		// Send the prompt to the API
		const response = await openai.images.generate({
			model: "dall-e-3", // Consider making this configurable
			prompt: prompt,
			n: 1, // DALL-E 3 only supports n=1
			size: '1024x1792',
			response_format: "b64_json"
		});
		console.log(response.data[0].b64_json)

		const end = Date.now() - start;

		const base64 = response.data[0].b64_json as string;
		const image = new MessageMedia("image/jpeg", base64, "image.jpg");

		cli.print(`[DALL-E] Answer to ${message.from} | OpenAI request took ${end}ms`);

		message.reply(image);
	} catch (error: any) {
		console.error("An error occured", error);
		message.reply("An error occured, please contact the administrator. (" + error.message + ")");
	}
};

module.exports = { handleMessageDALLE };
