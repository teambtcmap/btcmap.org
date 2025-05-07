import type { GeoJSON } from 'geojson';
import type leaflet from 'leaflet';
import type {
	DomEvent,
	FeatureGroup,
	LatLng,
	LayerGroup,
	// @ts-ignore
	MaplibreGL,
	Marker,
	TileLayer
} from 'leaflet';

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
	['population:date']?: string;
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

export type Theme = 'light' | 'dark';

export type DonationType = 'On-chain' | 'Lightning';

export type DropdownLink = { url: string; external?: boolean; icon: string; title: string };

export type ChartHistory = '7D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

export type Tickets = [] | 'error';

export type AreaPageProps = { id: string; name: string; tickets: Tickets; issues: RpcIssue[] };
