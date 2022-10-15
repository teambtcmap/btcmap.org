export const checkAddress = (element) => {
	if (element['addr:housenumber'] && element['addr:street'] && element['addr:city']) {
		return `${
			element['addr:housenumber'] + ' ' + element['addr:street'] + ', ' + element['addr:city']
		}`;
	} else if (element['addr:street'] && element['addr:city']) {
		return `${element['addr:street'] + ', ' + element['addr:city']}`;
	} else if (element['addr:city']) {
		return `${element['addr:city']}`;
	} else {
		return '';
	}
};
