import OpenAi from 'openai'


export let perplexity

export function initPerplexity() {
    perplexity = new OpenAi({
            apiKey: process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai',
        }
    );
    console.log("[Perplexity] Perplexity AI client initialized.");
}

// Add module.exports at the end
module.exports = {
    perplexity: () => perplexity, // Export a function to get the initialized instance
    initPerplexity
};

