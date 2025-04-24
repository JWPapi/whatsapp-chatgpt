// Removed type imports: Message, aiConfigTarget, aiConfigTypes, aiConfigValues, IAiConfig, dalleImageSize
// Assuming command modules are now .js files and export using module.exports
// Add require statements for command modules if they exist and are JS
// const GeneralModule = require("../commands/general");
// const ChatModule = require("../commands/chat");
// const GptModule = require("../commands/gpt");
// const TranscriptionModule = require("../commands/transcription");
// const StableDiffusionModule = require("../commands/stable-diffusion");

const config = require("../config"); // Assuming config.js

// Default config structure (adjust based on actual usage)
let aiConfig = { // Removed : IAiConfig type
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

// Placeholder for handleMessageAIConfig if it exists elsewhere or needs implementation
const handleMessageAIConfig = async (message, args) => {
	console.log("[AI-Config] handleMessageAIConfig called (placeholder). Message:", message.body, "Args:", args);
	// Implement actual config handling logic here
	message.reply("AI Config command is not fully implemented yet.");
};


function getConfig(target, type) { // Removed : string, : string, : any types
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

module.exports = {
    aiConfig,
    handleMessageAIConfig, // Exporting the placeholder or actual implementation
    initAiConfig,
    getConfig
};
