// Removed type imports: Message, aiConfigTarget, aiConfigTypes, aiConfigValues, IAiConfig, dalleImageSize
// Assuming command modules are now .js files and export using ESM
// Add import statements for command modules if they exist and are JS
// import * as GeneralModule from "../commands/general.js";
// import * as ChatModule from "../commands/chat.js";
// import * as GptModule from "../commands/gpt.js";
// import * as TranscriptionModule from "../commands/transcription.js";
// import * as StableDiffusionModule from "../commands/stable-diffusion.js";

import config from "../config.js"; // Assuming config.js is ESM

// Default config structure (adjust based on actual usage)
export let aiConfig = { // Removed : IAiConfig type, added export
	// dalle config removed
	// chatgpt: {}, // Add structure if needed
	commandsMap: {}
};

const initAiConfig = () => {
	// Register commands - Ensure these modules exist and export correctly
	// Filter out potentially missing/unconverted modules
	const modulesToRegister = [
		// ChatModule, // Uncomment if converted to JS
		// GeneralModule, // Uncomment if converted to JS
		// GptModule, // Uncomment if converted to JS
		// TranscriptionModule, // Uncomment if converted to JS
		// StableDiffusionModule // Uncomment if converted to JS
	].filter(mod => mod && typeof mod.register === 'function');

	if (modulesToRegister.length === 0) {
		console.warn("[AI-Config] No command modules found or converted to register.");
	}

	modulesToRegister.forEach((module) => {
		aiConfig.commandsMap[module.key] = module.register();
	});
	console.log("[AI-Config] Initialized AI config with registered command modules.");
};
export { initAiConfig }; // Export initAiConfig

// Placeholder for handleMessageAIConfig if it exists elsewhere or needs implementation
export const handleMessageAIConfig = async (message, args) => { // Added export
	console.log("[AI-Config] handleMessageAIConfig called (placeholder). Message:", message.body, "Args:", args);
	// Implement actual config handling logic here
	message.reply("AI Config command is not fully implemented yet.");
};


export function getConfig(target, type) { // Removed : string, : string, : any types, added export
	if (aiConfig.commandsMap[target] && aiConfig.commandsMap[target][type]) {
		if (typeof aiConfig.commandsMap[target][type].data === "function") {
			return aiConfig.commandsMap[target][type].data();
		}
		return aiConfig.commandsMap[target][type].data;
	}
	// Add checks for existence to prevent errors
	if (aiConfig.commandsMap[target] && aiConfig.commandsMap[target][type]) {
		if (typeof aiConfig.commandsMap[target][type].data === "function") {
			return aiConfig.commandsMap[target][type].data();
		}
		return aiConfig.commandsMap[target][type].data;
	}
	if (aiConfig[target] && aiConfig[target][type] !== undefined) {
	    return aiConfig[target][type];
    }
	console.warn(`[AI-Config] Config not found for target: ${target}, type: ${type}`);
	return undefined; // Return undefined or a default value if appropriate
}

// Removed module.exports as exports are now handled individually
