import { Icon } from '$lib/comp';
import type { Leaflet } from '$lib/types';
import type { DivIcon } from 'leaflet';

interface IconCacheEntry {
	htmlContent: string;
	timestamp: number;
}

// Cache configuration
const CACHE_CONFIG = {
	TTL: 5 * 60 * 1000, // 5 minutes
	MAX_SIZE: 1000
} as const;

// Global cache - using Map for better performance than object
const iconCache = new Map<string, IconCacheEntry>();

/**
 * Generate cache key for icon configuration
 */
const getCacheKey = (iconType: string, boosted: boolean, commentsCount: number): string =>
	`${iconType}_${boosted ? 'boosted' : 'normal'}_${commentsCount}`;

/**
 * Check if cache entry is still valid
 */
const isCacheEntryValid = (entry: IconCacheEntry): boolean =>
	Date.now() - entry.timestamp <= CACHE_CONFIG.TTL;

/**
 * Get HTML content from cache if valid
 */
const getHtmlFromCache = (key: string): string | null => {
	const entry = iconCache.get(key);

	if (!entry || !isCacheEntryValid(entry)) {
		iconCache.delete(key);
		return null;
	}

	return entry.htmlContent;
};

/**
 * Add HTML content to cache with LRU eviction
 */
const addHtmlToCache = (key: string, htmlContent: string): void => {
	// Simple LRU: remove oldest entry if cache is full
	if (iconCache.size >= CACHE_CONFIG.MAX_SIZE) {
		const oldestKey = iconCache.keys().next().value;
		if (oldestKey) {
			iconCache.delete(oldestKey);
		}
	}

	iconCache.set(key, {
		htmlContent,
		timestamp: Date.now()
	});
};

/**
 * Create DivIcon from HTML content
 */
const createDivIconFromHtml = (leaflet: Leaflet, htmlContent: string, boosted: boolean): DivIcon =>
	leaflet.divIcon({
		className: boosted ? 'boosted-icon' : 'div-icon',
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
		html: htmlContent
	});

/**
 * Generate HTML content for icon using Svelte component
 */
const createIconHtml = (iconType: string, boosted: boolean, commentsCount: number): string => {
	const className = boosted ? 'animate-wiggle' : '';
	const iconTmp = iconType !== 'question_mark' ? iconType : 'currency_bitcoin';

	// Create container element
	const iconContainer = document.createElement('div');
	iconContainer.className = 'icon-container relative flex items-center justify-center';

	// Create icon element with Svelte component
	const iconElement = document.createElement('div');
	new Icon({
		target: iconElement,
		props: {
			w: '20',
			h: '20',
			style: `${className} mt-[5.75px] text-white`,
			icon: iconTmp,
			type: 'material'
		}
	});
	iconContainer.appendChild(iconElement);

	// Add comment badge if needed
	if (commentsCount > 0) {
		const commentsCountSpan = document.createElement('span');
		commentsCountSpan.textContent = `${commentsCount}`;
		commentsCountSpan.className = [
			'absolute top-1 right-1 transform translate-x-1/2 -translate-y-1/2',
			'bg-green-600 text-white text-[10px] font-bold',
			'rounded-full w-4 h-4 flex items-center justify-center'
		].join(' ');
		iconContainer.appendChild(commentsCountSpan);
	}

	return iconContainer.outerHTML;
};

/**
 * Main icon generation function with smart caching
 */
export const generateOptimizedIcon = (
	leaflet: Leaflet,
	iconType: string,
	boosted: boolean,
	commentsCount: number
): DivIcon => {
	const key = getCacheKey(iconType, boosted, commentsCount);

	// Try cache first
	const cachedHtml = getHtmlFromCache(key);
	if (cachedHtml) {
		console.log(`Cache HIT for ${key}`);
		return createDivIconFromHtml(leaflet, cachedHtml, boosted);
	}

	// Generate new icon and cache the HTML
	console.log(`Cache MISS for ${key} - generating new icon`);
	const htmlContent = createIconHtml(iconType, boosted, commentsCount);
	addHtmlToCache(key, htmlContent);

	return createDivIconFromHtml(leaflet, htmlContent, boosted);
};

/**
 * Clear the icon cache (useful for memory management)
 */
export const clearIconCache = (): void => {
	iconCache.clear();
};

/**
 * Get cache statistics for monitoring
 */
export const getIconCacheStats = () => ({
	size: iconCache.size,
	maxSize: CACHE_CONFIG.MAX_SIZE,
	ttl: CACHE_CONFIG.TTL
});

/**
 * Factory function for creating icon generator (recommended approach)
 */
export const createIconGenerator = (leaflet: Leaflet) => ({
	generateIcon: (iconType: string, boosted: boolean, commentsCount: number) =>
		generateOptimizedIcon(leaflet, iconType, boosted, commentsCount),
	clearCache: clearIconCache,
	getCacheStats: getIconCacheStats
});
