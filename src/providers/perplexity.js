import OpenAi from 'openai'


export let perplexity

export function initPerplexity() {
    perplexity = new OpenAi({
            apiKey: process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai',
        }
    );
}


