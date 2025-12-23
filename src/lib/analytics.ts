// Privacy-focused analytics using Umami
// No cookies, no PII, GDPR compliant
// Only enabled in production

import { dev } from '$app/environment';

const ANALYTICS_HOSTNAME = 'btcmap.org';

type EventName =
	| 'search_query'
	| 'search_button_click'
	| 'category_filter'
	| 'boost_layer_toggle'
	| 'nearby_button_click'
	| 'worldwide_mode_click'
	| 'nearby_mode_click'
	| 'home_button_click'
	| 'show_all_on_map_click'
	| 'merchant_list_item_click'
	| 'nearby_filter_input'
	| 'zoom_in_click'
	| 'zoom_out_click'
	| 'fullscreen_click'
	| 'locate_click'
	| 'add_location_click'
	| 'community_map_click'
	| 'data_refresh_click'
	| 'layer_change';

declare global {
	interface Window {
		umami?: {
			track: (eventName: string, eventData?: Record<string, unknown>) => void;
		};
	}
}

export const trackEvent = (eventName: EventName, eventData?: Record<string, unknown>): void => {
	if (dev) return;
	if (typeof window === 'undefined') return;
	if (window.location.hostname !== ANALYTICS_HOSTNAME) return;
	if (!window.umami) return;

	window.umami.track(eventName, eventData);
};
