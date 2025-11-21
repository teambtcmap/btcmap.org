import { reportError, reports } from '$lib/store';
import { clearTables } from '$lib/sync/clearTables';
import type { Report } from '$lib/types';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import localforage from 'localforage';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const limit = 10000;

export const reportsSync = async () => {
	// clear tables if present
	clearTables(['reports', 'reports_v2', 'reports_v3', 'reports_v4', 'reports_v5']);

	// get reports from local
	await localforage
		.getItem<Report[]>('reports_v6')
		.then(async function (value) {
			// get reports from API if initial sync
			if (!value) {
				let updatedSince = '2022-01-01T00:00:00.000Z';
				let responseCount;
				let reportsData: Report[] = [];

				do {
					try {
						const response = await axios.get<Report[]>(
							`https://api.btcmap.org/v2/reports?updated_since=${updatedSince}&limit=${limit}`
						);

						updatedSince = response.data[response.data.length - 1]['updated_at'];
						responseCount = response.data.length;
						const responseIds = new Set(response.data.map((data) => data.id));
						const reportsUpdated = reportsData.filter((report) => !responseIds.has(report.id));
						reportsData = reportsUpdated;
						response.data.forEach((data) => reportsData.push(data));
					} catch (error) {
						reportError.set(
							'Could not load reports from API, please try again or contact BTC Map.'
						);
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (reportsData.length) {
					// filter out deleted reports
					const reportsFiltered = reportsData.filter((report) => !report['deleted_at']);

					// set response to local
					localforage
						.setItem('reports_v6', reportsFiltered)
						.then(function () {
							// set response to store
							reports.set(reportsFiltered);
						})
						.catch(function (err) {
							reports.set(reportsFiltered);
							reportError.set(
								'Could not store reports locally, please try again or contact BTC Map.'
							);
							console.error(err);
						});
				}
			} else {
				// start update sync from API
				// sort to get most recent record
				const cacheSorted = [...value];
				cacheSorted.sort((a, b) => Date.parse(b['updated_at']) - Date.parse(a['updated_at']));

				let updatedSince = cacheSorted[0]['updated_at'];
				let responseCount;
				let reportsData = value;
				let useCachedData = false;

				do {
					try {
						const response = await axios.get<Report[]>(
							`https://api.btcmap.org/v2/reports?updated_since=${updatedSince}&limit=${limit}`
						);

						// update new records if they exist
						const newReports = response.data;

						// check for new reports in local and purge if they exist
						if (newReports.length) {
							updatedSince = newReports[newReports.length - 1]['updated_at'];
							responseCount = newReports.length;

							const newReportIds = new Set(newReports.map((report) => report.id));
							const reportsUpdated = reportsData.filter((value) => !newReportIds.has(value.id));
							reportsData = reportsUpdated;

							// add new reports
							newReports.forEach((report) => {
								if (!report['deleted_at']) {
									reportsData.push(report);
								}
							});
						} else {
							// load reports from cache
							reports.set(value);
							useCachedData = true;
							break;
						}
					} catch (error) {
						// load reports from cache
						reports.set(value);
						useCachedData = true;

						reportError.set(
							'Could not update reports from API, please try again or contact BTC Map.'
						);
						console.error(error);
						break;
					}
				} while (responseCount === limit);

				if (!useCachedData) {
					// set updated reports locally
					localforage
						.setItem('reports_v6', reportsData)
						.then(function () {
							// set updated reports to store
							reports.set(reportsData);
						})
						.catch(function (err) {
							// set updated reports to store
							reports.set(reportsData);

							reportError.set(
								'Could not update reports locally, please try again or contact BTC Map.'
							);
							console.error(err);
						});
				}
			}
		})

		.catch(async function (err) {
			reportError.set('Could not load reports locally, please try again or contact BTC Map.');
			console.error(err);

			let updatedSince = '2022-01-01T00:00:00.000Z';
			let responseCount;
			let reportsData: Report[] = [];

			do {
				try {
					const response = await axios.get<Report[]>(
						`https://api.btcmap.org/v2/reports?updated_since=${updatedSince}&limit=${limit}`
					);

					updatedSince = response.data[response.data.length - 1]['updated_at'];
					responseCount = response.data.length;
					const responseIds = new Set(response.data.map((data) => data.id));
					const reportsUpdated = reportsData.filter((report) => !responseIds.has(report.id));
					reportsData = reportsUpdated;
					response.data.forEach((data) => reportsData.push(data));
				} catch (error) {
					reportError.set('Could not load reports from API, please try again or contact BTC Map.');
					console.error(error);
					break;
				}
			} while (responseCount === limit);

			if (reportsData.length) {
				// filter out deleted reports
				const reportsFiltered = reportsData.filter((report) => !report['deleted_at']);

				// set response to store
				reports.set(reportsFiltered);
			}
		});
};
