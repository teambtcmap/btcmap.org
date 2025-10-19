import type { Place } from './types';

export const PLACE_FIELDS = {
	CORE: [
		'id',
		'lat',
		'lon',
		'icon',
		'comments',
		'boosted_until'
	] as const satisfies (keyof Place)[],
	SYNC: ['deleted_at', 'updated_at'] as const satisfies (keyof Place)[],
	POPUP: [
		'name',
		'address',
		'phone',
		'website',
		'twitter',
		'facebook',
		'instagram',
		'email',
		'opening_hours',
		'created_at',
		'verified_at',
		'osm_id',
		'osm_url',
		'osm:contact:instagram',
		'osm:contact:twitter',
		'osm:contact:facebook',
		'osm:contact:phone',
		'osm:contact:website',
		'osm:contact:email',
		'boost:expires',
		'required_app_url',
		'osm:payment:onchain',
		'osm:payment:lightning',
		'osm:payment:lightning_contactless',
		'osm:payment:bitcoin',
		'osm:payment:uri',
		'osm:payment:coinos',
		'osm:payment:pouch',
		'osm:payment:lightning:companion_app_url',
		'osm:amenity',
		'osm:category',
		'osm:survey:date',
		'osm:check_date',
		'osm:check_date:currency:XBT'
	] as const satisfies (keyof Place)[]
} as const;

export const PLACE_FIELD_SETS = {
	MAP_SYNC: [...PLACE_FIELDS.CORE, ...PLACE_FIELDS.SYNC],
	COMPLETE_PLACE: [...PLACE_FIELDS.CORE, ...PLACE_FIELDS.POPUP]
} as const;

export const buildFieldsParam = (fields: readonly string[]) => fields.join(',');
