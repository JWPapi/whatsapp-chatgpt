// const { Message } = require("whatsapp-web.js"); // Message type often not needed in JS
// Use the exported perplexity client instance directly
import { perplexity as perplexityClient } from "../providers/perplexity.js"; // Import the instance, rename for clarity
import * as cli from "../cli/ui.js";

// Mapping from number to last conversation id (if needed for research context)
// const conversations = {};

export const handleMessageResearch = async (message, prompt) => { // Removed : Message, : string types, added export
    try {
        // Use the imported client instance directly
        const perplexity = perplexityClient; // Assign the imported instance
        if (!perplexity) {
             message.reply("Error: Perplexity AI client is not initialized or API key is missing.");
             console.error("[Research] Perplexity client not initialized.");
             return;
        }

        cli.print(`[Research] Received research prompt from ${message.from}: ${prompt}`);


        // ToDo: Check if we have a conversation with the user

        // Create new conversation
        const conv = await perplexity.chat.completions.create({
            model: 'sonar-pro',
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        })

        //log the model and token
        console.log("Conv: ", conv);

        message.reply(conv.choices[0].message.content);

    } catch (error) {
        console.error("An error occured", error);
        message.reply("An error occured, please contact the administrator. (" + error.message + ")");
    }
};

// Removed module.exports as handleMessageResearch is now exported directly
