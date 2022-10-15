import localforage from 'localforage';
import axios from 'axios';
import { users, userError } from '$lib/store';

export const usersSync = async () => {
	// get users from local
	await localforage
		.getItem('users')
		.then(async function (value) {
			// get users from API if initial sync
			if (!value) {
				try {
					const response = await axios.get('https://api.btcmap.org/v2/users');

					if (response.data.length) {
						// set response to local
						localforage
							.setItem('users', response.data)
							.then(function (value) {
								// set response to store
								users.set(response.data);
							})
							.catch(function (err) {
								axios
									.get('https://api.btcmap.org/v2/users')
									.then(function (response) {
										users.set(response.data);
									})
									.catch(function (error) {
										userError.set(
											'Could not store users locally, please try again or contact BTC Map.'
										);
										console.log(error);
									});

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
				// load users locally first
				users.set(value);

				// start update sync from API
				try {
					const response = await axios.get(
						`https://api.btcmap.org/v2/users?updated_since=${value[0]['updated_at']}`
					);

					// update new records if they exist
					let newUsers = response.data;

					// check for new users in local and purge if they exist
					if (newUsers.length) {
						let updatedUsers = value.filter((value) => {
							if (newUsers.find((user) => user.id === value.id)) {
								return false;
							} else {
								return true;
							}
						});

						// add new users
						updatedUsers.forEach((user) => {
							newUsers.push(user);
						});

						// set updated users locally
						localforage
							.setItem('users', newUsers)
							.then(function (value) {
								// set updated users to store
								users.set(newUsers);
							})
							.catch(function (err) {
								userError.set(
									'Could not update users locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					}
				} catch (error) {
					userError.set('Could not update users from API, please try again or contact BTC Map.');
					console.error(error);
				}
			}
		})

		.catch(function (err) {
			userError.set('Could not load users locally, please try again or contact BTC Map.');
			console.log(err);
		});
};
