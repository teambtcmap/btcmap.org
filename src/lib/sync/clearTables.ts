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
							console.log('Key is cleared!');
						})
						.catch(function (err) {
							console.log(err);
						});
				}
			})
			.catch(function (err) {
				console.log(err);
			});
	}
};
