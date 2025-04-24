const { intro, spinner, note, outro, text } = require("@clack/prompts");
const color = require("picocolors");

const s = spinner();

const print = (text) => {
	// Removed : string type
	console.log(color.green("◇") + "  " + text);
};

export const printIntro = () => {
	intro(color.bgCyan(color.white(" Whatsapp ChatGPT & DALL-E ")));
	note("A Whatsapp bot that uses OpenAI's ChatGPT and DALL-E to generate text and images from a prompt.");
	s.start("Starting");
};

const printQRCode = (qr) => {
	// Removed : string type
	s.stop("Client is ready!");
	note(qr, "Scan the QR code below to login to Whatsapp Web.");
};

export const printLoading = () => {
	s.stop("Authenticated!");
	s.start("Logging in");
};

export const printAuthenticated = () => {
	s.stop("Session started!");
	s.start("Opening session");
};

export const printAuthenticationFailure = () => {
	s.stop("Authentication failed!");
};

export const printOutro = () => {
	s.stop("Loaded!");
	outro("Whatsapp ChatGPT & DALLE is ready to use.");
};

// Export all functions using CommonJS
module.exports = {
	print,
	printIntro,
	printQRCode,
	printLoading,
	printAuthenticated,
	printAuthenticationFailure,
	printOutro
};
