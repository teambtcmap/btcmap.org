import localforage from 'localforage';

export const clearTables = (tables: string[]) => {
	for (const table of tables) {
		localforage
			.getItem(table)
			.then(function (value) {
				if (value) {
					localforage
						.removeItem(table)
						.then(function () {
							console.info('Key is cleared!');
						})
						.catch(function (err) {
							console.error(err);
						});
				}
			})
			.catch(function (err) {
				console.error(err);
			});
	}
};
