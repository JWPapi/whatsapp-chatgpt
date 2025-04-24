import qrcode from "qrcode-terminal";
import { Client, Events, LocalAuth } from "whatsapp-web.js"; // Removed Message type

// Constants
import constants from "./constants.js"; // Assuming constants.js will use default export

// CLI
import * as cli from "./cli/ui.js"; // ui.js uses named exports
import { handleIncomingMessage } from "./handlers/message.js"; // Assuming message.js will use named export

// Config & Providers
import { initAiConfig } from "./handlers/ai-config.js"; // Assuming ai-config.js will use named export
import { initOpenAI } from "./providers/openai.js"; // Assuming openai.js will use named export
import { initPerplexity } from "./providers/perplexity.js"; // Assuming perplexity.js will use named export
import { setupCronJobs } from "./cron/cron.js"; // Assuming cron.js will use named export

// Ready timestamp of the bot
let botReadyTimestamp = null; // Removed Date | null type

// Entrypoint
const start = async () => {
	const wwebVersion = "2.2412.54";
	cli.printIntro();

	// WhatsApp Client
	const client = new Client({
		puppeteer: {
			args: ["--no-sandbox"]
		},
		authStrategy: new LocalAuth({
			dataPath: process.env.ENVIRONMENT === "development" ? "./wweb_auth_data" : "/var/data"
		}),
		webVersionCache: {
			type: "remote",
			remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${wwebVersion}.html`
		}
	});

	// WhatsApp auth
	client.on(Events.QR_RECEIVED, (qr) => { // Removed : string type
		qrcode.generate(qr, { small: true }, (qrcode) => { // Removed : string type
			cli.printQRCode(qrcode);
		});
	});

	// WhatsApp loading
	client.on(Events.LOADING_SCREEN, (percent) => {
		if (percent == "0") {
			cli.printLoading();
		}
	});

	// WhatsApp authenticated
	client.on(Events.AUTHENTICATED, () => {
		cli.printAuthenticated();
	});

	// WhatsApp authentication failure
	client.on(Events.AUTHENTICATION_FAILURE, () => {
		cli.printAuthenticationFailure();
	});

	// WhatsApp ready
	client.on(Events.READY, () => {
		// Print outro
		cli.printOutro();

		// Set bot ready timestamp
		botReadyTimestamp = new Date();

		setupCronJobs(client);

		initAiConfig();
		initOpenAI();
		initPerplexity();
	});

	// WhatsApp message
	client.on(Events.MESSAGE_RECEIVED, async (message) => { // Removed : any type
		// Ignore if message is from status broadcast
		if (message.from == constants.statusBroadcast) {
			cli.print(`Ignoring message from status broadcast: ${message.from}`);
			return;
		}

		await handleIncomingMessage(message);
	});

	// Reply to own message
	client.on(Events.MESSAGE_CREATE, async (message) => { // Removed : Message type
		// Ignore if message is from status broadcast
		if (message.from == constants.statusBroadcast) return;

		// Ignore if it's not from me
		if (!message.fromMe) return;

		await handleIncomingMessage(message);
	});

	// WhatsApp initialization
	client.initialize();
};

start();

// Export using ESM named export
export { botReadyTimestamp };
