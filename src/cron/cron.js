const cron = require("node-cron");

// Example function to demonstrate sending a message
async function sendScheduledMessage(client, chatId, message) {
	try {
		console.log(`[Cron] Attempting to send message to ${chatId}: "${message}"`);
		await client.sendMessage(chatId, message);
		console.log(`[Cron] Message sent successfully to ${chatId}.`);
	} catch (error) {
		console.error(`[Cron] Failed to send message to ${chatId}:`, error);
	}
}

async function setupCronJobs(client) {
	console.log("[Cron] Setting up cron jobs...");

	// --- Define your cron jobs here ---

	// Example 1: Send a message every day at 9:00 AM (New York Time)
	// Replace 'your_chat_id@c.us' with the actual chat ID you want to message
	const dailyChatId = "your_chat_id@c.us"; // TODO: Replace with actual Chat ID
	const dailyMessage = "Good morning! This is your scheduled daily update.";
	cron.schedule(
		"0 9 * * *",
		() => {
			console.log("[Cron] Triggering daily 9:00 AM job.");
			sendScheduledMessage(client, dailyChatId, dailyMessage);
		},
		{
			scheduled: true,
			timezone: "America/New_York" // Example timezone
		}
	);

	// Example 2: Run a simple log message every 5 minutes
	cron.schedule(
		"*/5 * * * *",
		() => {
			console.log(
				"[Cron] Running a task every 5 minutes - ",
				new Date().toLocaleTimeString()
			);
			// Add any other logic that doesn't require the client here
		},
		{
			scheduled: true
		}
	);

	// Example 3: Send a message on weekdays at 1 PM (London Time)
	const weekdayChatId = "another_chat_id@c.us"; // TODO: Replace with actual Chat ID
	const weekdayMessage = "Weekday afternoon check-in!";
	cron.schedule(
		"0 13 * * 1-5", // 1 PM (13:00) on Monday to Friday
		() => {
			console.log("[Cron] Triggering weekday 1:00 PM job.");
			sendScheduledMessage(client, weekdayChatId, weekdayMessage);
		},
		{
			scheduled: true,
			timezone: "Europe/London" // Example timezone
		}
	);

	console.log("[Cron] Cron jobs scheduled.");
}

// Export the function using module.exports
module.exports = { setupCronJobs };
