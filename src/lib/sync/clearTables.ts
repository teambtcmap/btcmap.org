import localforage from "localforage";

export const clearTables = (tables: string[]) => {
	for (const table of tables) {
		localforage
			.getItem(table)
			.then((value) => {
				if (value) {
					localforage
						.removeItem(table)
						.then(() => {
							console.info("Key is cleared!");
						})
						.catch((err) => {
							console.error(err);
						});
				}
			})
			.catch((err) => {
				console.error(err);
			});
	}
};
