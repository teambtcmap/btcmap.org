import localforage from 'localforage';
import axios from 'axios';
import { reports, reportError } from '$lib/store';

export const reportsSync = async () => {
	// get reports from local
	await localforage
		.getItem('reports')
		.then(async function (value) {
			// get reports from API if initial sync
			if (!value) {
				try {
					const response = await axios.get('https://api.btcmap.org/v2/reports');

					if (response.data.length) {
						// filter out deleted reports
						const reportsFiltered = response.data.filter((report) => !report['deleted_at']);

						// set response to local
						localforage
							.setItem('reports', response.data)
							// eslint-disable-next-line no-unused-vars
							.then(function (value) {
								// set response to store
								reports.set(reportsFiltered);
							})
							.catch(function (err) {
								reports.set(reportsFiltered);
								reportError.set(
									'Could not store reports locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					} else {
						reportError.set(
							'Reports API returned an empty result, please try again or contact BTC Map.'
						);
					}
				} catch (error) {
					reportError.set('Could not load reports from API, please try again or contact BTC Map.');
					console.log(error);
				}
			} else {
				// filter out deleted reports
				const reportsFiltered = value.filter((report) => !report['deleted_at']);

				// start update sync from API
				try {
					// sort to get most recent record
					let cacheSorted = [...value];
					cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

					const response = await axios.get(
						`https://api.btcmap.org/v2/reports?updated_since=${cacheSorted[0]['updated_at']}`
					);

					// update new records if they exist
					let newReports = response.data;

					// check for new reports in local and purge if they exist
					if (newReports.length) {
						let updatedReports = value.filter((value) => {
							if (newReports.find((report) => report.id === value.id)) {
								return false;
							} else {
								return true;
							}
						});

						// add new reports
						updatedReports.forEach((report) => {
							newReports.push(report);
						});

						// filter out deleted reports
						const newReportsFiltered = newReports.filter((report) => !report['deleted_at']);

						// set updated reports locally
						localforage
							.setItem('reports', newReports)
							// eslint-disable-next-line no-unused-vars
							.then(function (value) {
								// set updated reports to store
								reports.set(newReportsFiltered);
							})
							.catch(function (err) {
								// set updated reports to store
								reports.set(newReportsFiltered);

								reportError.set(
									'Could not update reports locally, please try again or contact BTC Map.'
								);
								console.log(err);
							});
					} else {
						// load reports from cache
						reports.set(reportsFiltered);
					}
				} catch (error) {
					// load reports from cache
					reports.set(reportsFiltered);

					reportError.set(
						'Could not update reports from API, please try again or contact BTC Map.'
					);
					console.error(error);
				}
			}
		})

		.catch(function (err) {
			reportError.set('Could not load reports locally, please try again or contact BTC Map.');
			console.log(err);
		});
};
