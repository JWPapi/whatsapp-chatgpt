import cron from "node-cron";

export async function setupCronJobs(client) {
	// Schedule a task to run every minute
	cron.schedule("*/1 * * * *", async () => {
		console.log("Running cron job every minute");
		// Add your cron job logic here
		// For example, you can call a function to perform some task
		// await someFunction(client)
	});
}
