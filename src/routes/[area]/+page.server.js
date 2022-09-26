import { redirect } from '@sveltejs/kit';

const areas = [
	{ name: 'bitcoin-island-philippines', url: '/map?lat=11.93&long=121.92&lat=12.00&long=121.94' }
];

export async function load({ params }) {
	let { area } = params;
	areas.forEach((record) => {
		if (record.name === area) {
			throw redirect(302, record.url);
		} else {
			throw redirect(307, '/map');
		}
	});
}
