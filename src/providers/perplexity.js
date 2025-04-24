import OpenAi from "openai"; // Kept 'OpenAi' as per original, ensure this is correct package/export name

let perplexity; // Added semicolon

function initPerplexity() {
	perplexity = new OpenAi({
		apiKey: process.env.PERPLEXITY_API_KEY,
		baseURL: "https://api.perplexity.ai"
	});
	console.log("[Perplexity] Perplexity AI client initialized.");
}

// Use named ESM exports
export {
	perplexity, // Export the instance directly
	initPerplexity
};
