import { redirect, error } from '@sveltejs/kit';

const areas = [
	{
		name: 'bitcoin-island-philippines',
		url: '/map?lat=12.005489474835585&long=122.00523376464845&lat=11.932356183978753&long=121.84043884277345'
	}
];

export async function load({ params }) {
	let { area } = params;
	areas.forEach((record) => {
		if (record.name === area) {
			throw redirect(302, record.url);
		} else {
			throw error(404, 'Not Found');
		}
	});
}
