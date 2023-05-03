import {Message} from "whatsapp-web.js";
import * as cli from "../cli/ui";

const {Client} = require("@notionhq/client")

const handleMessageNotion = async (message: Message, prompt: string) => {
    try {

        cli.print(`[Notion] Received prompt from ${message.from}: ${prompt}`);

        const notion = new Client({auth: process.env.NOTION_TOKEN,})
        const user = getUserInfo(prompt, message)


        if (prompt.startsWith("list")) {
            const toDos = await getEntriesFromDB(user.db, notion)
            await message.reply(`*List of all entries:*\n [ ] ${toDos.join("\n [ ] ")}`)
            return
        }


        await addEntryToDB(prompt, user.db, notion)
        await message.reply(`Added to ${user.name} Notion: ${prompt}`)

    } catch (error: any) {
        console.error("An error occured", error);
        await message.reply("An error occured, please contact the administrator. (" + error.message + ")");
    }
}

const generateDBEntry = (prompt: string, database: string) => {
    return {
        parent: {
            type: 'database_id',
            database_id: database,
        },
        properties: {
            'Name': {
                title: [
                    {
                        text: {
                            content: prompt,
                        }
                    }
                ]
            }
        }
    }
}

const addEntryToDB = async (prompt: string, database: string, client: Object) => {
    prompt = prompt.replace("julian", "").replace("kambiz", "")
    const dbEntry = generateDBEntry(prompt, database)
    const response = await client.pages.create(dbEntry)
    cli.print(`[Notion] Response: ${JSON.stringify(response)}`);
    return
}

const getEntriesFromDB = async (database: string, client: Object) => {
    const response = await client.databases.query({
        database_id: database,
        filter: {
            and: [
                {
                    property: 'Status',
                    select: {
                        is_empty: true
                    }
                },
                {
                    property: 'Is Due',
                    formula: {
                        checkbox: {
                            equals: true
                        }
                    }
                }]
        }
    })
    return response.results.map((page) => page.properties.Name.title[0].plain_text)
}

const getUserInfo = (prompt: string, message: Message) => {
    const jwDatabaseId = 'b430559a3ced44c1bf2b5db8285853c1'
    const kdDatabaseId = 'c13d709df5124795bd977dd019c7bde5'
    prompt = prompt.toLowerCase()
    if (prompt.startsWith("julian") || prompt.startsWith("list julian")) return {db:jwDatabaseId, name: "Julian"}
    if (prompt.startsWith("kambiz") || prompt.startsWith("list kambiz")) return {db:kdDatabaseId, name: "Kambiz"}
    if (message.from  == "4915112960532@c.us") return {db:jwDatabaseId, name: "Julian"}
    if (message.from  == "4915140773278@c.us") return {db:kdDatabaseId, name: "Kambiz"}
}


export {handleMessageNotion};
