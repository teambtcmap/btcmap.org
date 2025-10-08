import { theme, areas } from '$lib/store';
import { areasSync } from '$lib/sync/areas';
import { PLACE_FIELD_SETS } from '$lib/api-fields';
import type { Continents, Element, Grade, IssueIcon, Place } from '$lib/types';
import { toast } from '@zerodevx/svelte-toast';
import type { Chart } from 'chart.js';
import { get } from 'svelte/store';
import rewind from '@mapbox/geojson-rewind';
import { geoContains } from 'd3-geo';
import DOMPurify from 'dompurify';
import { parseISO, isThisYear, isAfter, subDays, format, formatDistanceToNow } from 'date-fns';

export const errToast = (m: string) => {
	toast.push(m, {
		theme: {
			'--toastBarBackground': '#DF3C3C'
		}
	});
};

export const warningToast = (m: string) => {
	toast.push(m, {
		theme: {
			'--toastBarBackground': '#FACA15'
		},
		duration: 10000
	});
};

export const successToast = (m: string) => {
	toast.push(m, {
		theme: {
			'--toastBarBackground': '#22C55E'
		}
	});
};

export function getRandomColor() {
	const letters = '0123456789ABCDEF';
	let color = '#';
	for (let i = 0; i < 6; i++) {
		color += letters[Math.floor(Math.random() * 16)];
	}
	return color;
}

export const detectTheme = () => {
	if (
		localStorage.theme === 'dark' ||
		(!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
	) {
		return 'dark';
	} else {
		return 'light';
	}
};

export const updateChartThemes = (
	charts: Chart<'line' | 'bar', number[] | undefined, string>[]
) => {
	if (get(theme) === 'dark') {
		charts.forEach((chart) => {
			if (chart.options.scales?.x?.grid && chart.options.scales?.y?.grid) {
				chart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.15)';
				chart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.15)';
				chart.update();
			}
		});
	} else {
		charts.forEach((chart) => {
			if (chart.options.scales?.x?.grid && chart.options.scales?.y?.grid) {
				chart.options.scales.x.grid.color = 'rgba(0, 0, 0, 0.1)';
				chart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.1)';
				chart.update();
			}
		});
	}
};

export const formatElementID = (id: string) => {
	const elementIdSplit = id.split(':');
	const elementIdFormatted =
		elementIdSplit[0].charAt(0).toUpperCase() +
		elementIdSplit[0].slice(1, elementIdSplit[0].length) +
		' ' +
		elementIdSplit[1];

	return elementIdFormatted;
};

export const getGrade = (upToDatePercent: number): Grade => {
	switch (true) {
		case upToDatePercent >= 95:
			return 5;
		case upToDatePercent >= 75:
			return 4;
		case upToDatePercent >= 50:
			return 3;
		case upToDatePercent >= 25:
			return 2;
		case upToDatePercent >= 0:
		default:
			return 1;
	}
};

export const getIssueIcon = (issue_code: string): IssueIcon => {
	if (issue_code.startsWith('invalid_tag_value')) {
		return 'fa-calendar-days';
	}
	if (issue_code.startsWith('misspelled_tag_name')) {
		return 'fa-spell-check';
	}
	if (issue_code == 'missing_icon') {
		return 'fa-icons';
	}
	if (issue_code == 'not_verified') {
		return 'fa-clipboard-question';
	}
	if (issue_code == 'outdated') {
		return 'fa-hourglass-end';
	}
	if (issue_code == 'outdated_soon') {
		return 'fa-hourglass-half';
	}
	return 'fa-list-check';
};

export const getIssueHelpLink = (issue_code: string) => {
	if (issue_code == 'outdated' || issue_code == 'outdated_soon' || issue_code == 'not_verified') {
		return 'https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Verifying-Existing-Merchants';
	}
	if (issue_code.startsWith('invalid_tag_value')) {
		return 'https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#tagging-guidance';
	}
	if (issue_code.startsWith('misspelled_tag_name')) {
		return 'https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#tagging-guidance';
	}
	return undefined;
};

export const isEven = (number: number) => {
	return number % 2 === 0;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function debounce(func: (e?: any) => void, timeout = 500) {
	let timer: ReturnType<typeof setTimeout>;
	// @ts-expect-error: introducing typecheck, this was failing, so ingoring for now
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			// @ts-expect-error: introducing typecheck, this was failing, so ingoring for now
			func.apply(this, args);
		}, timeout);
	};
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const validateContinents = (continent: Continents) =>
	[
		'africa',
		'asia',
		'europe',
		'north-america',
		'oceania',
		'south-america',
		'Africa',
		'Asia',
		'Europe',
		'North America',
		'Oceania',
		'South America'
	].includes(continent);

export const isBoosted = (item: Element | Place | undefined | null) =>
	item &&
	('tags' in item ? item.tags['boost:expires'] : item.boosted_until) &&
	Date.parse(('tags' in item ? item.tags['boost:expires'] : item.boosted_until) || '') > Date.now();

export async function getAreaIdsByCoordinates(lat: number, long: number): Promise<string[]> {
	console.debug('Checking areas with coordinates:', { lat, long });
	await areasSync(); // Get latest areas
	const allAreas = get(areas);
	console.debug('Total areas to check:', allAreas.length);

	return allAreas
		.filter((area) => {
			if (!area.tags.geo_json) {
				console.warn('Area missing geo_json:', area.id);
				return false;
			}
			const rewoundPoly = rewind(area.tags.geo_json, true);
			const contains = geoContains(rewoundPoly, [long, lat]);
			if (contains) {
				console.debug('Found matching area:', area.id);
			}
			return contains;
		})
		.map((area) => area.id);
}

export const formatOpeningHours = (str: string): string => {
	const html = str
		.split(/;\s*/)
		.map((part) => `<span>${part.trim()}</span>`)
		.join('');

	return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['span'] });
};

const RECENT_DATE_THRESHOLD_DAYS = 30;

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

const parseDateSafely = (isoString: string): Date | null => {
	try {
		const date = parseISO(isoString);
		return isValidDate(date) ? date : null;
	} catch {
		return null;
	}
};

const isRecentDate = (date: Date, thresholdDays: number = RECENT_DATE_THRESHOLD_DAYS): boolean => {
	return isAfter(date, subDays(new Date(), thresholdDays));
};

export const formatVerifiedHuman = (isoDateString?: string): string => {
	if (!isoDateString) return '';

	const parsedDate = parseDateSafely(isoDateString);
	if (!parsedDate) return isoDateString;

	// Recent dates (≤30 days) → "3 days ago"
	if (isRecentDate(parsedDate)) {
		return formatDistanceToNow(parsedDate, { addSuffix: true });
	}

	// Same year → "15 October"
	if (isThisYear(parsedDate)) {
		return format(parsedDate, 'd MMMM');
	}

	// Different year → "15 October 2023"
	return format(parsedDate, 'd MMMM yyyy');
};

// Cache for enhanced place data to avoid repeated API calls
const enhancedPlacesCache = new Map<string, Place>();

/**
 * Fetches enhanced place data (name, address, etc.) for a specific place ID
 * Uses caching to avoid repeated API calls for the same place
 */
export async function fetchEnhancedPlace(placeId: string): Promise<Place | null> {
	// Check cache first
	if (enhancedPlacesCache.has(placeId)) {
		return enhancedPlacesCache.get(placeId)!;
	}

	try {
		const response = await fetch(
			`https://api.btcmap.org/v4/places/${placeId}?fields=${PLACE_FIELD_SETS.COMPLETE_PLACE.join(',')}`
		);

		if (!response.ok) {
			console.warn(`Failed to fetch enhanced data for place ${placeId}:`, response.status);
			return null;
		}

		const basePlace: Place = await response.json();
		let enhancedPlace: Place = { ...basePlace };

		// Map osm:contact fields to official fields as fallback
		if (!enhancedPlace.instagram && enhancedPlace['osm:contact:instagram']) {
			enhancedPlace.instagram = enhancedPlace['osm:contact:instagram'].startsWith('http')
				? enhancedPlace['osm:contact:instagram']
				: `https://instagram.com/${enhancedPlace['osm:contact:instagram']}`;
		}
		if (!enhancedPlace.twitter && enhancedPlace['osm:contact:twitter']) {
			enhancedPlace.twitter = enhancedPlace['osm:contact:twitter'].startsWith('http')
				? enhancedPlace['osm:contact:twitter']
				: `https://twitter.com/${enhancedPlace['osm:contact:twitter']}`;
		}
		if (!enhancedPlace.facebook && enhancedPlace['osm:contact:facebook']) {
			enhancedPlace.facebook = enhancedPlace['osm:contact:facebook'].startsWith('http')
				? enhancedPlace['osm:contact:facebook']
				: `https://facebook.com/${enhancedPlace['osm:contact:facebook']}`;
		}

		// If the place has an OSM ID, also fetch from v2 Elements API to get any remaining contact:* fields
		// that might not be mapped in the v4 Places API
		if (enhancedPlace.osm_id) {
			try {
				const elementsResponse = await fetch(
					`https://api.btcmap.org/v2/elements/${enhancedPlace.osm_id}`
				);
				if (elementsResponse.ok) {
					const elementsData = await elementsResponse.json();
					const osmTags = elementsData.osm_json?.tags || {};

					// Merge any remaining contact:* fields into the place data
					const mergedPlace = { ...enhancedPlace };
					if (osmTags['contact:instagram'] && !mergedPlace.instagram) {
						mergedPlace.instagram = osmTags['contact:instagram'].startsWith('http')
							? osmTags['contact:instagram']
							: `https://instagram.com/${osmTags['contact:instagram']}`;
					}
					if (osmTags['contact:twitter'] && !mergedPlace.twitter) {
						mergedPlace.twitter = osmTags['contact:twitter'].startsWith('http')
							? osmTags['contact:twitter']
							: `https://twitter.com/${osmTags['contact:twitter']}`;
					}
					if (osmTags['contact:facebook'] && !mergedPlace.facebook) {
						mergedPlace.facebook = osmTags['contact:facebook'].startsWith('http')
							? osmTags['contact:facebook']
							: `https://facebook.com/${osmTags['contact:facebook']}`;
					}

					// Also check for direct social media fields in OSM
					if (osmTags.instagram && !mergedPlace.instagram) {
						mergedPlace.instagram = osmTags.instagram.startsWith('http')
							? osmTags.instagram
							: `https://instagram.com/${osmTags.instagram}`;
					}
					if (osmTags.twitter && !mergedPlace.twitter) {
						mergedPlace.twitter = osmTags.twitter.startsWith('http')
							? osmTags.twitter
							: `https://twitter.com/${osmTags.twitter}`;
					}
					if (osmTags.facebook && !mergedPlace.facebook) {
						mergedPlace.facebook = osmTags.facebook.startsWith('http')
							? osmTags.facebook
							: `https://facebook.com/${osmTags.facebook}`;
					}
					enhancedPlace = mergedPlace;
				}
			} catch (elementsError) {
				// Ignore errors from v2 Elements API - we still have v4 data
				console.warn(`Failed to fetch additional OSM data for place ${placeId}:`, elementsError);
			}
		}

		// Cache the result
		enhancedPlacesCache.set(placeId, enhancedPlace);

		return enhancedPlace;
	} catch (error) {
		console.error(`Error fetching enhanced place data for ${placeId}:`, error);
		return null;
	}
}
