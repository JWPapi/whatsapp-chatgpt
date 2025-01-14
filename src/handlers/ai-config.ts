import { Message } from "whatsapp-web.js";
import { aiConfigTarget, aiConfigTypes, aiConfigValues, IAiConfig } from "../types/ai-config";
import { dalleImageSize } from "../types/dalle-config";
import { GeneralModule } from "../commands/general";
import { ChatModule } from "../commands/chat";
import { GptModule } from "../commands/gpt";
import { TranscriptionModule } from "../commands/transcription";
import { StableDiffusionModule } from "../commands/stable-diffusion";

import config from "../config";

let aiConfig: IAiConfig = {
	dalle: {
		size: dalleImageSize["512x512"]
	},
	// chatgpt: {}
	commandsMap: {}
};

const initAiConfig = () => {
	// Register commands
	[ChatModule, GeneralModule, GptModule, TranscriptionModule, StableDiffusionModule].forEach((module) => {
		aiConfig.commandsMap[module.key] = module.register();
	});
	console.log("[AI-Config] Initialized AI config");
};


export function getConfig(target: string, type: string): any {
	if (aiConfig.commandsMap[target] && aiConfig.commandsMap[target][type]) {
		if (typeof aiConfig.commandsMap[target][type].data === "function") {
			return aiConfig.commandsMap[target][type].data();
		}
		return aiConfig.commandsMap[target][type].data;
	}
	return aiConfig[target][type];
}


export { aiConfig, handleMessageAIConfig, initAiConfig };
