// src/lib/map/optimized-icons.ts
import type { Leaflet } from '$lib/types';
import type { DivIcon } from 'leaflet';

interface IconCacheEntry {
	divIcon: DivIcon;
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

		// Check cache first
		const cached = this.getFromCache(key);
		if (cached) {
			return cached;
		}

		// Generate new icon using template
		const divIcon = this.createIconFromTemplate(iconType, boosted, commentsCount);

		// Cache the result
		this.addToCache(key, divIcon);

		return divIcon;
	}

	private getCacheKey(iconType: string, boosted: boolean, commentsCount: number): string {
		return `${iconType}_${boosted ? 'boosted' : 'normal'}_${commentsCount}`;
	}

	private getFromCache(key: string): DivIcon | null {
		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		// Check if cache entry is still valid
		if (Date.now() - entry.timestamp > this.CACHE_TTL) {
			this.cache.delete(key);
			return null;
		}

		return entry.divIcon;
	}

	private addToCache(key: string, divIcon: DivIcon): void {
		// Prevent cache from growing too large
		if (this.cache.size >= this.MAX_CACHE_SIZE) {
			// Remove oldest entries (simple LRU)
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, {
			divIcon,
			timestamp: Date.now()
		});
	}

	private createIconFromTemplate(
		iconType: string,
		boosted: boolean,
		commentsCount: number
	): DivIcon {
		const iconClass = iconType !== 'question_mark' ? iconType : 'currency_bitcoin';
		const containerClass = boosted ? 'marker-boosted animate-wiggle' : 'marker-normal';

		const html = `
			<div class="${containerClass}">
				<div class="marker-background">
					<i class="material-icons marker-icon">${iconClass}</i>
				</div>
				${commentsCount > 0 ? `<span class="comment-badge">${commentsCount}</span>` : ''}
			</div>
		`;

		return this.leaflet.divIcon({
			className: boosted ? 'boosted-icon' : 'div-icon',
			iconSize: [32, 43],
			iconAnchor: [16, 43],
			popupAnchor: [0, -43],
			html
		});
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
