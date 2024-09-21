import {Message} from "whatsapp-web.js";
import {perplexity} from "../providers/perplexity";
import * as cli from "../cli/ui";


// Mapping from number to last conversation id

const handleMessageResearch = async (message: Message, prompt: string) => {
    try {

        cli.print(`[GPT] Received  research prompt from ${message.from}: ${prompt}`);


        // ToDo: Check if we have a conversation with the user

        // Create new conversation
        const conv = await perplexity.chat.completions.create({
            model: 'llama-3.1-sonar-small-128k-online',
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

    } catch (error: any) {
        console.error("An error occured", error);
        message.reply("An error occured, please contact the administrator. (" + error.message + ")");
    }
};



export {handleMessageResearch};
