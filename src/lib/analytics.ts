// Privacy-focused analytics using Umami
// No cookies, no PII, GDPR compliant
// Only enabled in production

import type { PasswordChange } from "#lib/account.js";
import type { BasemapId } from "#lib/map/basemaps.js";
import type { VerifiedFilterYears } from "#lib/map/verifiedFilter.js";
import type { MerchantListMode } from "#lib/merchantListStore.js";
import type { AddEntryMethod } from "#lib/placementMode.js";
import type { SavedItemType } from "#lib/savedItems.js";

import { dev } from "$app/env";

const ANALYTICS_HOSTNAME = "btcmap.org";

// Every event and the data it carries: `undefined` for none. trackEvent
// takes exactly this payload, so a funnel's dimensions can't drift between
// the sites that fire it. Keep the keys sorted; a new event goes in its
// place, not at the end. Keys already in Umami keep their names, casing
// included, so its reports stay continuous.
type EventPayloads = {
	account_button_click: { logged_in: boolean };
	account_nostr_auth_url_click: undefined;
	account_nostr_forget_click: undefined;
	account_nostr_link_click: { method: NostrSignMethod };
	account_nostr_link_failure: {
		method: NostrSignMethod;
		status: FailureStatus | "taken";
	};
	account_nostr_link_success: { method: NostrSignMethod };
	account_nostr_options_toggle: { open: boolean };
	account_nostr_unlink_click: undefined;
	account_nostr_unlink_open: undefined;
	account_nostr_unlink_success: undefined;
	account_password_change_click: undefined;
	account_password_change_failure: {
		status: FailureStatus | Exclude<PasswordChange, "changed">;
	};
	account_password_change_success: undefined;
	account_username_save_click: undefined;
	account_username_save_failure: { status: FailureStatus | "taken" };
	account_username_save_success: undefined;
	add_location_click: undefined;
	add_place_address_jump: undefined;
	add_place_address_prefill: { outcome: "hit" | "miss" };
	add_place_confirm: undefined;
	add_place_details_back: undefined;
	add_place_details_enter: undefined;
	add_place_enter: { method: AddEntryMethod };
	add_place_move_pin_click: undefined;
	add_place_move_pin_success: undefined;
	add_place_nearby_candidate_click: { placeId: number };
	add_place_nearby_continue: undefined;
	add_place_nearby_shown: { count: number };
	add_place_osm_edit_click: undefined;
	add_place_review_back: undefined;
	add_place_review_enter: undefined;
	add_place_review_queue_click: undefined;
	add_place_submit_failure: { attributed: boolean; status: FailureStatus };
	add_place_submit_success: { attributed: boolean };
	add_place_tagger_guide_click: undefined;
	boost_layer_toggle: undefined;
	browser_language: {
		language: string;
		language_code: string;
		language_region?: string;
	};
	category_filter: { category: string; mode: MerchantListMode };
	comment_add_click: { source: CommentSource };
	comment_add_failure: { source: CommentSource; status: FailureStatus };
	comment_add_success: { source: CommentSource };
	community_map_click: undefined;
	drawer_collapse_button_click: undefined;
	drawer_swipe_collapse: undefined;
	drawer_swipe_dismiss: undefined;
	drawer_swipe_expand: undefined;
	enable_precise_distances_click: undefined;
	heatmap_layer_toggle: { enabled: boolean };
	home_button_click: undefined;
	issues_map_click: undefined;
	join_us_link_click: { target: JoinUsTarget };
	language_switch: { language: string };
	layer_change: { layer: BasemapId };
	layers_panel_open: undefined;
	locate_click: undefined;
	login_create_account_click: undefined;
	login_method_switch: { method: "username" | "nostr" };
	login_nostr_auth_url_click: undefined;
	login_nostr_bunker_click: { method: "bunker" };
	login_nostr_connect_copy_click: { method: "copy" };
	login_nostr_connect_open_click: { method: "open" };
	login_nostr_connect_qr_click: { method: "qr" };
	login_nostr_extension_click: { method: "extension" };
	login_nostr_failure: { method: NostrSignMethod; status: FailureStatus };
	login_nostr_forget_click: undefined;
	login_nostr_nsec_click: { method: "nsec" };
	login_nostr_options_toggle: { open: boolean };
	login_nostr_saved_click: { method: "saved" };
	login_nostr_success: { method: NostrSignMethod };
	login_password_success: undefined;
	merchant_list_item_click: { mode: MerchantListMode };
	merchant_name_click: undefined;
	merchant_profile_click: undefined;
	my_account_click: undefined;
	my_notes_click: undefined;
	my_notes_row_click: undefined;
	my_photos_click: undefined;
	my_photos_tile_click: { link: "photo" | "place" };
	nav_menu_open: { variant: "main" | "communities" };
	note_add_click: { method: NoteAddMethod };
	note_add_failure: { method: NoteAddMethod; status: FailureStatus };
	note_add_success: { method: NoteAddMethod; icon: string; public: boolean };
	note_delete_click: undefined;
	note_delete_failure: { status: FailureStatus };
	note_delete_success: undefined;
	note_edit_click: undefined;
	note_edit_failure: { status: FailureStatus };
	note_edit_success: { text: boolean; icon: boolean };
	note_open: { source: "map" | "link" };
	note_prompt_create_account_click: undefined;
	note_prompt_login_click: undefined;
	note_visibility_change: { public: boolean };
	place_photo_add_click: {
		source: PlacePhotoSource;
		entry: "header" | "empty";
		signedIn: boolean;
	};
	place_photo_add_failure: {
		source: PlacePhotoSource;
		count: number;
		status: FailureStatus;
	};
	place_photo_add_success: { source: PlacePhotoSource; count: number };
	place_photo_delete_cancel: { source: PlacePhotoSource };
	place_photo_delete_click: { source: PlacePhotoSource };
	place_photo_delete_failure: {
		source: PlacePhotoSource;
		status: FailureStatus;
	};
	place_photo_delete_success: { source: PlacePhotoSource };
	place_photo_link_copy: { source: PlacePhotoSource };
	place_photo_menu_open: { source: PlacePhotoSource };
	place_photo_open: {
		source: PlacePhotoSource;
		index: number;
		via: "tile" | "deeplink";
	};
	place_photo_prompt_create_account_click: undefined;
	place_photo_prompt_login_click: undefined;
	place_photo_strip_scroll: {
		source: PlacePhotoSource;
		direction: "back" | "forward";
	};
	place_photo_upload_undo_click: { source: PlacePhotoSource; count: number };
	place_photo_upload_undo_success: { source: PlacePhotoSource; count: number };
	place_photo_view: { source: PlacePhotoSource; index: number };
	save_item_toggle: {
		saved: boolean;
		type: SavedItemType;
		source: "save_button" | "save_prompt";
	};
	save_prompt_create_account_click: { type: SavedItemType };
	save_prompt_login_click: { type: SavedItemType };
	save_prompt_shown: { type: SavedItemType };
	search_bar_tap_expand: undefined;
	search_input_focus: { source: "panel" };
	search_query: undefined;
	search_sheet_swipe_collapse: undefined;
	search_sheet_swipe_expand: undefined;
	search_sheet_tap_expand: undefined;
	show_all_on_map_click: undefined;
	signup_button_click: { source: SignupEntry };
	signup_create_account_failure: {
		source: SignupSource;
		status: FailureStatus | "taken";
	};
	signup_create_account_success: { source: SignupSource };
	verified_filter_change: {
		years: `${NonNullable<VerifiedFilterYears>}` | "any";
	};
	worldview_toggle: { enabled: boolean };
};

export type EventName = keyof EventPayloads;

// The events that carry no data, for code that picks a name at runtime
// (e.g. per-gesture event tables) and fires it bare.
export type BareEventName = {
	[N in EventName]: EventPayloads[N] extends undefined ? N : never;
}[EventName];

// Why a request-backed step failed (*_failure events, #1575): the API's
// status, "no_response" for a request that got none, "client" for a
// failure before or without a request (failureStatus in apiError.ts). An
// event adds the refusals its own flow names (e.g. "taken").
export type FailureStatus = number | "no_response" | "client";

// How the add-note card was opened (note_add_click breakdown).
export type NoteAddMethod = "menu" | "right_click" | "long_press";

// Where the comment flow was opened from (funnel breakdown).
export type CommentSource = "map_drawer" | "area_drawer" | "merchant_page";

// Where the photo strip, viewer or My photos was used (funnel breakdown).
export type PlacePhotoSource =
	| "merchant_page"
	| "map_drawer"
	| "area_drawer"
	| "my_photos";

// Which Nostr transport signed the login or link.
export type NostrSignMethod =
	| "extension"
	| "nsec"
	| "saved"
	| "bunker"
	| "qr"
	| "open"
	| "copy";

// Where a "Sign up" link was followed from, and where the account was made.
export type SignupEntry = "user_menu" | "map_menu" | "add_place";
export type SignupSource = "signup_page" | "auth_prompt";

// The /join-us guide's links and the home page's call to action.
export type JoinUsTarget =
	| "countries"
	| "communities"
	| "maintain-example"
	| "osm-signup"
	| "matrix"
	| "osm-about"
	| "home-cta";

// The payload argument for an event: none for `undefined`, required
// otherwise. Distributes over a union of names (e.g. a per-mode event
// table), accepting any of their payloads.
type PayloadArgs<N extends EventName> = N extends EventName
	? EventPayloads[N] extends undefined
		? []
		: [eventData: EventPayloads[N]]
	: never;

declare global {
	interface Window {
		umami?: {
			track: (eventName: string, eventData?: Record<string, unknown>) => void;
		};
	}
}

export const trackEvent = <N extends EventName>(
	eventName: N,
	...[eventData]: PayloadArgs<N>
): void => {
	if (dev) return;
	if (typeof window === "undefined") return;
	if (window.location.hostname !== ANALYTICS_HOSTNAME) return;
	if (!window.umami) return;

	window.umami.track(eventName, eventData);
};

export const trackBrowserLanguage = (): void => {
	const language = navigator.language || "unknown";
	const [languageCode, languageRegion] = language.split("-");
	trackEvent("browser_language", {
		language,
		language_code: languageCode,
		...(languageRegion && { language_region: languageRegion }),
	});
};
