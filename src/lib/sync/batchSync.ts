// Utility for coordinating multiple sync operations
// Runs all syncs in parallel and provides aggregated error logging

export async function batchSync(syncFunctions: Array<() => Promise<void>>): Promise<void> {
	const results = await Promise.allSettled(syncFunctions.map((fn) => fn()));

	const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

	if (failures.length > 0) {
		console.error(
			`${failures.length}/${results.length} sync operations failed:`,
			failures.map((f) => f.reason)
		);
	}
}
