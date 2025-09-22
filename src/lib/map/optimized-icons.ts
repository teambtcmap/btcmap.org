// src/lib/map/optimized-icons.ts
import { Icon } from '$lib/comp';
import type { Leaflet } from '$lib/types';
import type { DivIcon } from 'leaflet';

interface IconCacheEntry {
	htmlContent: string; // Cache HTML string instead of DivIcon
	timestamp: number;
}

export class OptimizedIconGenerator {
	private cache = new Map<string, IconCacheEntry>();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
	private readonly MAX_CACHE_SIZE = 1000;

	constructor(private leaflet: Leaflet) {}

	/**
	 * Generate optimized icon using templates instead of Svelte components
	 */
	generateIcon(iconType: string, boosted: boolean, commentsCount: number): DivIcon {
		const key = this.getCacheKey(iconType, boosted, commentsCount);

		// Check cache for HTML content first
		const cachedHtml = this.getHtmlFromCache(key);
		if (cachedHtml) {
			console.log(`Cache HIT for ${key}`);
			return this.createDivIconFromHtml(cachedHtml, boosted);
		}

		console.log(`Cache MISS for ${key} - generating new icon`);
		// Generate new icon and cache the HTML content
		const htmlContent = this.createIconHtml(iconType, boosted, commentsCount);
		this.addHtmlToCache(key, htmlContent);

		return this.createDivIconFromHtml(htmlContent, boosted);
	}

	private getCacheKey(iconType: string, boosted: boolean, commentsCount: number): string {
		return `${iconType}_${boosted ? 'boosted' : 'normal'}_${commentsCount}`;
	}

	private getHtmlFromCache(key: string): string | null {
		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		// Check if cache entry is still valid
		if (Date.now() - entry.timestamp > this.CACHE_TTL) {
			this.cache.delete(key);
			return null;
		}

		return entry.htmlContent;
	}

	private addHtmlToCache(key: string, htmlContent: string): void {
		// Prevent cache from growing too large
		if (this.cache.size >= this.MAX_CACHE_SIZE) {
			// Remove oldest entries (simple LRU)
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, {
			htmlContent,
			timestamp: Date.now()
		});
	}

	private createDivIconFromHtml(htmlContent: string, boosted: boolean): DivIcon {
		return this.leaflet.divIcon({
			className: boosted ? 'boosted-icon' : 'div-icon',
			iconSize: [32, 43],
			iconAnchor: [16, 43],
			popupAnchor: [0, -43],
			html: htmlContent
		});
	}

	private createIconHtml(iconType: string, boosted: boolean, commentsCount: number): string {
		const className = boosted ? 'animate-wiggle' : '';
		const iconTmp = iconType !== 'question_mark' ? iconType : 'currency_bitcoin';

		const iconContainer = document.createElement('div');
		iconContainer.className = 'icon-container relative flex items-center justify-center';

		const iconElement = document.createElement('div');
		// Create Svelte Icon component (but cache the result)
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

		if (commentsCount > 0) {
			const commentsCountSpan = document.createElement('span');
			commentsCountSpan.textContent = `${commentsCount}`;
			commentsCountSpan.className =
				'absolute top-1 right-1 transform translate-x-1/2 -translate-y-1/2 ' + // Positioning
				'bg-green-600 text-white text-[10px] font-bold ' + // Colors and text
				'rounded-full w-4 h-4 flex items-center justify-center'; // Shape and alignment
			iconContainer.appendChild(commentsCountSpan);
		}

		// Return HTML string instead of DivIcon
		return iconContainer.outerHTML;
	}

	/**
	 * Clear cache (useful for memory management)
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Get cache statistics for monitoring
	 */
	getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
		return {
			size: this.cache.size,
			maxSize: this.MAX_CACHE_SIZE
		};
	}
}

// Singleton instance
let iconGenerator: OptimizedIconGenerator | null = null;

export const getIconGenerator = (leaflet: Leaflet): OptimizedIconGenerator => {
	if (!iconGenerator) {
		iconGenerator = new OptimizedIconGenerator(leaflet);
	}
	return iconGenerator;
};
