export interface OrganizationDisplayName {
	id: string;
	displayName: string;
}

export const organizationDisplayNames: Record<string, string> = {
	'2140-meetups': '2140 Meetups',
	bitcoin4india: 'Bitcoin4India',
	'bitcoin-4-iranians': 'Bitcoin 4 Iranians',
	'bitcoin-bulgaria': 'Bitcoin Bulgaria',
	'bitcoin-indonesia': 'Bitcoin Indonesia',
	'bitcoin-jamii': 'Bitcoin Jamii',
	'bitcoin-paraguay': 'Bitcoin Paraguay',
	'bit-devs': 'BitDevs',
	'breizh-bitcoin': 'Breizh Bitcoin',
	'decouvre-bitcoin': 'Découvre Bitcoin',
	dvadsatjeden: 'Dvadsaťjeden',
	'dwadziescia-jeden': 'Dwadzieścia Jeden',
	eenentwintig: 'Eenentwintig',
	einundzwanzig: 'Einundzwanzig',
	enogtyve: 'Enogtyve',
	'go-btc': 'Go BTC',
	jednadvacet: 'Jednadvacet',
	'mi-primer-bitcoin': 'Mi Primer Bitcoin',
	'plan-b-network': 'Plan B Network',
	sst: 'Satoshi Somos Todos',
	'satoshi-spritz': 'Satoshi Spritz',
	uaibit: 'UAIBIT'
};

//Function will return the raw `organization` tag if it is not in the list of known organizations above.`
export const getOrganizationDisplayName = (organizationId: string): string => {
	return organizationDisplayNames[organizationId] || organizationId;
};

export const getAllOrganizations = (): OrganizationDisplayName[] => {
	return Object.entries(organizationDisplayNames).map(([id, displayName]) => ({
		id,
		displayName
	}));
};
