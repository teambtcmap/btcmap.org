// Privacy-focused analytics using Umami
// No cookies, no PII, GDPR compliant
// Only enabled in production

import { dev } from '$app/environment';

type EventName =
	| 'search_query'
	| 'search_button_click'
	| 'category_filter'
	| 'boost_layer_toggle'
	| 'nearby_button_click'
	| 'worldwide_mode_click'
	| 'nearby_mode_click';

type CategoryFilterData = {
	category: string;
};

declare global {
	interface Window {
		umami?: {
			track: (eventName: string, eventData?: Record<string, unknown>) => void;
		};
	}
}

export const trackEvent = (eventName: EventName, eventData?: CategoryFilterData): void => {
	if (dev) return;
	if (typeof window === 'undefined') return;
	if (!window.umami) return;

	window.umami.track(eventName, eventData);
};
