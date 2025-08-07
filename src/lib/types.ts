import type { GeoJSON, Polygon, MultiPolygon } from 'geojson';
import type leaflet from 'leaflet';
import type {
	DomEvent,
	FeatureGroup,
	LatLng,
	LayerGroup,
	Marker,
	TileLayer,
	// @ts-ignore
	MaplibreGL
} from 'leaflet';

// nominatim.openstreetmap.org API
// https://nominatim.org/release-docs/latest/api/Search

export interface NominatimResponse {
	place_id: number;
	licence: string;
	osm_type: string;
	osm_id: number;
	lat: string;
	lon: string;
	class: string;
	type: string;
	place_rank: number;
	importance: number;
	addresstype?: string;
	name?: string;
	display_name: string;
	boundingbox: [string, string, string, string];
	geojson?: Polygon | MultiPolygon; // Use GeoJSON types here
}

// BACKEND

export type Area = {
	id: string;
	tags: AreaTags;
	created_at: string;
	updated_at: string;
	deleted_at: string;
};

export type AreaTags = {
	type: AreaType;
	name: string;
	description?: string;
	continent: Continents;
	url_alias: string;
	geo_json: GeoJSON;
	['icon:square']: string; // countries don't have this tag yet
	organization?: string;
	language?: string;
	population?: string;
	area_km2?: number;
	['population:date']?: string;
	['population:year']?: number;
	['contact:website']?: string;
	['contact:email']?: string;
	['contact:nostr']?: string;
	['contact:twitter']?: string;
	['contact:second_twitter']?: string;
	['contact:meetup']?: string;
	['contact:eventbrite']?: string;
	['contact:telegram']?: string;
	['contact:discord']?: string;
	['contact:youtube']?: string;
	['contact:github']?: string;
	['contact:reddit']?: string;
	['contact:instagram']?: string;
	['contact:whatsapp']?: string;
	['contact:facebook']?: string;
	['contact:linkedin']?: string;
	['contact:rss']?: string;
	['contact:signal']?: string;
	['contact:simplex']?: string;
	['tips:lightning_address']?: string;
	['tips:url']?: string;
	sponsor?: boolean;
	['box:north']?: string;
	['box:east']?: string;
	['box:south']?: string;
	['box:west']?: string;
};

export type AreaType = 'community' | 'country' | 'trash';

export type Community = {
	id: string;
	tags: AreaTags & {
		type: 'community';
	};
	created_at: string;
	updated_at: string;
	deleted_at: string;
};

export type Continents =
	| 'africa'
	| 'asia'
	| 'europe'
	| 'north-america'
	| 'oceania'
	| 'south-america'
	| 'Africa'
	| 'Asia'
	| 'Europe'
	| 'North America'
	| 'Oceania'
	| 'South America';

export type Element = {
	id: string;
	osm_json: ElementOSM;
	tags: {
		['icon:android']: string;
		category: string;
		['boost:expires']?: string;
		['payment:uri']?: string;
		['payment:coinos']?: string;
		['payment:pouch']?: string;
		issues?: Issue[];
		areas?: Array<{ id: number; url_alias: string }>;
		comments?: number;
	};
	created_at: string;
	updated_at: string;
	deleted_at: string;
};

export interface MerchantComment {
	id: number;
	text: string;
	created_at: string;
}

export interface MerchantPageData {
	id: string;
	name?: string;
	lat: number;
	lon: number;
	comments: MerchantComment[];
	// Additional fields from Element data
	icon?: string;
	address?: string;
	description?: string;
	note?: string;
	hours?: string;
	payment?: PayMerchant;
	boosted?: string;
	verified: string[];
	phone?: string;
	website?: string;
	email?: string;
	twitter?: string;
	instagram?: string;
	facebook?: string;
	thirdParty?: boolean;
	paymentMethod?: string;
	// OSM data for edit links and tag functionality
	osmType: string;
	osmId: number;
	osmTags: OSMTags;
	// Element data for complex client logic (communities, events, etc.)
	elementData: Element;
}

export type RpcIssue = {
	element_osm_type: string;
	element_osm_id: number;
	element_name: string;
	issue_code: string;
};

export type IssueType =
	| 'date_format'
	| 'misspelled_tag'
	| 'missing_icon'
	| 'not_verified'
	| 'out_of_date'
	| 'out_of_date_soon';

export type Issue = {
	description: string;
	severity: number;
	type: IssueType;
};

export type IssueIcon =
	| 'fa-calendar-days'
	| 'fa-spell-check'
	| 'fa-icons'
	| 'fa-clipboard-question'
	| 'fa-hourglass-end'
	| 'fa-list-check'
	| 'fa-hourglass-half';

export type RpcGetMostActiveUsersItem = {
	id: number;
	name: string;
	image_url: string;
	tip_address: string;
	edits: number;
	created: number;
	updated: number;
	deleted: number;
};

export type ElementOSM = {
	type: 'node' | 'way' | 'relation';
	id: number;
	lat: number;
	lon: number;
	bounds: { minlat: number; minlon: number; maxlat: number; maxlon: number } | null;
	tags?: OSMTags;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OSMTags = { [key: string]: any };

export type Event = {
	id: number;
	user_id: number;
	element_id: string;
	type: EventType;
	tags: object;
	created_at: string;
	updated_at: string;
	deleted_at: string;
};

export type EventType = 'create' | 'update' | 'delete';

export type Report = {
	id: number;
	area_id: string;
	date: string;
	tags: ReportTags;
	created_at: string;
	updated_at: string;
	deleted_at: string;
};

export type ReportTags = {
	total_elements: number;
	total_elements_onchain: number;
	total_elements_lightning: number;
	total_elements_lightning_contactless: number;
	total_atms: number;
	up_to_date_elements: number;
	up_to_date_percent: number;
	outdated_elements: number;
	legacy_elements: number;
	avg_verification_date: string;
};

export type Grade = 1 | 2 | 3 | 4 | 5;

export type User = {
	id: number;
	osm_json: {
		id: number;
		display_name: string;
		description: string;
		img: { href: string } | null;
		account_created: string;
	};
	tags: { ['supporter:expires']?: string };
	created_at: string;
	updated_at: string;
	deleted_at: string;
};

// FRONTEND

// leaflet

export type Leaflet = typeof leaflet;

export type DomEventType = typeof DomEvent;

export type MapGroups = { [key: string]: LayerGroup | FeatureGroup.SubGroup };

export type BaseMaps = {
	'OpenFreeMap Liberty': MaplibreGL;
	'OpenFreeMap Dark': MaplibreGL;
	OpenStreetMap: TileLayer;
};

// map

export type Boost = { id: string; name: string; boost: string } | undefined;

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface SearchElement extends ElementOSM {
	latLng: LatLng;
	marker: Marker<any>;
	icon: string;
	boosted: string | undefined;
}
/* eslint-enable  @typescript-eslint/no-explicit-any */

export interface SearchResult extends SearchElement {
	distanceKm: number;
	distanceMi: number;
}

// Search types for JSON-RPC search API
export interface SearchItem {
	type: 'element' | 'user';
	id: string;
	name: string;
	description?: string;
	score: number;
}

export interface SearchPlaceResult extends SearchItem {
	distanceKm: number;
	distanceMi: number;
	latLng?: LatLng;
	marker?: Marker<any>;
}

export interface SearchRpcResponse {
	jsonrpc: '2.0';
	result: {
		items: SearchItem[];
	};
	id: number;
}

export type PayMerchant = { type: string; url?: string; username?: string } | undefined;

// leaderboards

export type TaggerLeaderboard = {
	avatar: string;
	tagger: string;
	id: number;
	created: number;
	updated: number;
	deleted: number;
	total: number;
	tip: string;
};

export type ProfileLeaderboard = { id: number; total: number };

export interface LeaderboardArea extends Area {
	report: Report;
	grade: Grade;
}

// tagger

export enum BadgeType {
	Contribution = 'contribution',
	Achievement = 'achievement'
}

export type EarnedBadge = { title: string; icon: string; type: BadgeType };

export enum TipType {
	Address = 'address',
	Url = 'url'
}

// events

export interface ActivityEvent extends Event {
	location: string;
	merchantId: string;
	tagger?: User;
}

// misc

export interface GiteaLabel {
	id: number;
	name: string;
	color: string;
	description?: string;
}

export interface GiteaIssue {
	id: number;
	number: number;
	title: string;
	created_at: string;
	html_url: string;
	labels: GiteaLabel[];
	user: {
		login: string;
		avatar_url: string;
		html_url: string;
	};
	comments: number;
	assignees: {
		login: string;
		avatar_url: string;
		html_url: string;
	}[];
}

export type Tickets = GiteaIssue[] | 'error';

export type Theme = 'light' | 'dark';

export type DonationType = 'On-chain' | 'Lightning';

export type DropdownLink = { url: string; external?: boolean; icon: string; title: string };

export type ChartHistory = '7D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

export type AreaPageProps = {
	id: string;
	name: string;
	tickets: Tickets;
	issues: RpcIssue[];
	elements?: Element[];
};

// V4 API Types
export type Place = {
	id: number;
	lat: number;
	lon: number;
	icon: string;
	comments?: number;
	deleted_at?: string; // Only present when fetching with include_deleted=true
	updated_at?: string; // Only present when fetching with updated_since parameter
	boosted_until?: string; // Only present when location is boosted
	// Standard documented fields
	name?: string;
	address?: string;
	opening_hours?: string;
	created_at?: string;
	verified_at?: string;
	osm_id?: string;
	osm_url?: string;
	phone?: string;
	website?: string;
	twitter?: string;
	facebook?: string;
	instagram?: string;
	line?: string;
	email?: string;
	// OSM payment method fields
	'osm:payment:onchain'?: 'yes';
	'osm:payment:lightning'?: 'yes';
	'osm:payment:lightning_contactless'?: 'yes';
	'osm:payment:bitcoin'?: 'yes';
	'osm:payment:uri'?: string;
	'osm:payment:coinos'?: string;
	'osm:payment:pouch'?: string;
	'osm:payment:lightning:requires_companion_app'?: 'yes';
	'osm:payment:lightning:companion_app_url'?: string;
	// OSM category fields
	'osm:amenity'?: string;
	'osm:category'?: string;
	// OSM tags that might be useful
	'osm:survey:date'?: string;
	'osm:check_date'?: string;
	'osm:check_date:currency:XBT'?: string;
};
