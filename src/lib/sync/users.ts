import { userError, users } from '$lib/store';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';

axiosRetry(axios, { retries: 3 });

const limit = 7500;

export const usersSync = async () => {
	// clear potentially broken users v1 sync due to top level ID changing from string to int
	await localforage
		.getItem('users')
		.then(function (value) {
			if (value) {
				localforage
					.removeItem('users')
					.then(function () {
						console.log('Key is cleared!');
					})
					.catch(function (err) {
						userError.set('Could not clear users locally, please try again or contact BTC Map.');
						console.log(err);
					});
			}
		})
		.catch(function (err) {
			userError.set('Could not check users locally, please try again or contact BTC Map.');
			console.log(err);
		});

	// get users from local
	await localforage
		.getItem('users_v2')
		.then(async function (value) {
			// get users from API if initial sync
			if (!value) {
				let updatedSince = '2022-01-01T00:00:00.000Z';
				let responseCount;
				let usersData = [];

				do {
					try {
						const response = await axios.get(
							`https://api.btcmap.org/v2/users?updated_since=${updatedSince}&limit=${limit}`
						);

						if (response.data.length) {
							updatedSince = response.data[response.data.length - 1]['updated_at'];
							responseCount = response.data.length;
							usersData.filter((user) => !response.data.find((data) => data.id === user.id));
							response.data.forEach((data) => usersData.push(data));
						} else {
							userError.set(
								'Users API returned an empty result, please try again or contact BTC Map.'
							);
							break;
						}
					} catch (error) {
						userError.set('Could not load users from API, please try again or contact BTC Map.');
						console.log(error);
						break;
					}
				} while (responseCount === limit);

				if (usersData.length) {
					// filter out deleted users
					const usersFiltered = usersData.filter((user) => !user['deleted_at']);

					// set response to local
					localforage
						.setItem('users_v2', usersData)
						// eslint-disable-next-line no-unused-vars
						.then(function (value) {
							// set response to store
							users.set(usersFiltered);
						})
						.catch(function (err) {
							users.set(usersFiltered);
							userError.set('Could not store users locally, please try again or contact BTC Map.');
							console.log(err);
						});
				}
			} else {
				// filter out deleted users
				const usersFiltered = value.filter((user) => !user['deleted_at']);

				// start update sync from API
				// sort to get most recent record
				let cacheSorted = [...value];
				cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

				let updatedSince = cacheSorted[0]['updated_at'];
				let responseCount;
				let usersData = value;
				let useCachedData = false;

				do {
					try {
						const response = await axios.get(
							`https://api.btcmap.org/v2/users?updated_since=${updatedSince}&limit=${limit}`
						);

						// update new records if they exist
						let newUsers = response.data;

						// check for new users in local and purge if they exist
						if (newUsers.length) {
							updatedSince = newUsers[newUsers.length - 1]['updated_at'];
							responseCount = newUsers.length;

							usersData.filter((value) => {
								if (newUsers.find((user) => user.id == value.id)) {
									return false;
								} else {
									return true;
								}
							});

							// add new users
							newUsers.forEach((user) => {
								usersData.push(user);
							});
						} else {
							// load users from cache
							users.set(usersFiltered);
							useCachedData = true;
							break;
						}
					} catch (error) {
						// load users from cache
						users.set(usersFiltered);
						useCachedData = true;

						userError.set('Could not update users from API, please try again or contact BTC Map.');
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (!useCachedData) {
					// filter out deleted users
					const newUsersFiltered = usersData.filter((user) => !user['deleted_at']);

					// set updated users locally
					localforage
						.setItem('users_v2', usersData)
						// eslint-disable-next-line no-unused-vars
						.then(function (value) {
							// set updated users to store
							users.set(newUsersFiltered);
						})
						.catch(function (err) {
							// set updated users to store
							users.set(newUsersFiltered);

							userError.set('Could not update users locally, please try again or contact BTC Map.');
							console.log(err);
						});
				}
			}
		})

		.catch(async function (err) {
			userError.set('Could not load users locally, please try again or contact BTC Map.');
			console.log(err);

			let updatedSince = '2022-01-01T00:00:00.000Z';
			let responseCount;
			let usersData = [];

			do {
				try {
					const response = await axios.get(
						`https://api.btcmap.org/v2/users?updated_since=${updatedSince}&limit=${limit}`
					);

					if (response.data.length) {
						updatedSince = response.data[response.data.length - 1]['updated_at'];
						responseCount = response.data.length;
						usersData.filter((user) => !response.data.find((data) => data.id === user.id));
						response.data.forEach((data) => usersData.push(data));
					} else {
						userError.set(
							'Users API returned an empty result, please try again or contact BTC Map.'
						);
						break;
					}
				} catch (error) {
					userError.set('Could not load users from API, please try again or contact BTC Map.');
					console.log(error);
					break;
				}
			} while (responseCount === limit);

			if (usersData.length) {
				// filter out deleted users
				const usersFiltered = usersData.filter((user) => !user['deleted_at']);

				// set response to store
				users.set(usersFiltered);
			}
		});
};
