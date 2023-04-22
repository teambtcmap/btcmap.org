import localforage from 'localforage';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { users, userError } from '$lib/store';

axiosRetry(axios, { retries: 3 });

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
				try {
					const response = await axios.get('https://api.btcmap.org/v2/users');

					if (response.data.length) {
						// filter out deleted users
						const usersFiltered = response.data.filter((user) => !user['deleted_at']);

						// set response to local
						localforage
							.setItem('users_v2', response.data)
							// eslint-disable-next-line no-unused-vars
							.then(function (value) {
								// set response to store
								users.set(usersFiltered);
							})
							.catch(function (err) {
								users.set(usersFiltered);
								userError.set(
									'Could not store users locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					} else {
						userError.set(
							'Users API returned an empty result, please try again or contact BTC Map.'
						);
					}
				} catch (error) {
					userError.set('Could not load users from API, please try again or contact BTC Map.');
					console.log(error);
				}
			} else {
				// filter out deleted users
				const usersFiltered = value.filter((user) => !user['deleted_at']);

				// start update sync from API
				try {
					// sort to get most recent record
					let cacheSorted = [...value];
					cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

					const response = await axios.get(
						`https://api.btcmap.org/v2/users?updated_since=${cacheSorted[0]['updated_at']}`
					);

					// update new records if they exist
					let newUsers = response.data;

					// check for new users in local and purge if they exist
					if (newUsers.length) {
						let updatedUsers = value.filter((value) => {
							if (newUsers.find((user) => user.id == value.id)) {
								return false;
							} else {
								return true;
							}
						});

						// add new users
						updatedUsers.forEach((user) => {
							newUsers.push(user);
						});

						// filter out deleted users
						const newUsersFiltered = newUsers.filter((user) => !user['deleted_at']);

						// set updated users locally
						localforage
							.setItem('users_v2', newUsers)
							// eslint-disable-next-line no-unused-vars
							.then(function (value) {
								// set updated users to store
								users.set(newUsersFiltered);
							})
							.catch(function (err) {
								// set updated users to store
								users.set(newUsersFiltered);

								userError.set(
									'Could not update users locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					} else {
						// load users from cache
						users.set(usersFiltered);
					}
				} catch (error) {
					// load users from cache
					users.set(usersFiltered);

					userError.set('Could not update users from API, please try again or contact BTC Map.');
					console.error(error);
				}
			}
		})

		.catch(async function (err) {
			userError.set('Could not load users locally, please try again or contact BTC Map.');
			console.log(err);

			try {
				const response = await axios.get('https://api.btcmap.org/v2/users');

				if (response.data.length) {
					// filter out deleted users
					const usersFiltered = response.data.filter((user) => !user['deleted_at']);

					// set response to store
					users.set(usersFiltered);
				} else {
					userError.set('Users API returned an empty result, please try again or contact BTC Map.');
				}
			} catch (error) {
				userError.set('Could not load users from API, please try again or contact BTC Map.');
				console.log(error);
			}
		});
};
