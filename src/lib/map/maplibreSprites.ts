import type { Map as MapLibreMap } from "maplibre-gl";

import type { Place } from "$lib/types";
import { isBoosted } from "$lib/utils";

// Mirrors Icon.svelte's material-symbol resolution. Keep in sync.
export const materialExceptions: Record<string, string> = {
	camping: "material-symbols:camping-rounded",
	gate: "material-symbols:gate",
	cooking: "material-symbols:cooking",
	dentistry: "material-symbols:dentistry",
	sauna: "material-symbols:sauna",
	info_outline: "material-symbols:info-outline",
	skull: "material-symbols:skull",
	currency_bitcoin: "material-symbols:currency-bitcoin",
};

export const resolveIconifyName = (icon: string): string => {
	const key = icon === "question_mark" ? "currency_bitcoin" : icon;
	return materialExceptions[key] ?? `ic:outline-${key.replace(/_/g, "-")}`;
};

export const PIN_PATH =
	"M0 16.0333C0 6.08 8.05161 0.131836 15.8361 0.131836C23.6205 0.131836 31.6721 6.08 31.6721 16.0333C31.6721 26.461 16.9494 41.3035 16.3229 41.9301C16.1941 42.0595 16.0185 42.1318 15.8361 42.1318C15.6536 42.1318 15.478 42.0595 15.3493 41.9301C14.7227 41.3035 0 26.461 0 16.0333Z";

export const PIN_FILL_REGULAR = "#0E95AF";
export const PIN_FILL_BOOSTED = "#F7931A";

export const spriteName = (icon: string, boosted: boolean): string =>
	`pin-${boosted ? "b" : "r"}-${icon}`;

export const fetchIconifyByName = async (
	iconifyName: string,
): Promise<string | null> => {
	const path = iconifyName.replace(":", "/");
	const url = `https://api.iconify.design/${path}.svg?color=white&width=20&height=20`;
	const res = await fetch(url);
	if (!res.ok) return null;
	return await res.text();
};

// Cascading fallback for icon names that don't exist in `ic:outline`.
// The btcmap dataset has ~6 such category values worldwide (e.g.
// `potted_plant`, `footprint`); try material-symbols next, then fall
// back to the Bitcoin glyph so every pin has at least a recognizable
// shape.
export const fetchIconInnerSvg = async (icon: string): Promise<string> => {
	const primary = resolveIconifyName(icon);
	const primarySvg = await fetchIconifyByName(primary);
	if (primarySvg) return primarySvg;
	if (primary.startsWith("ic:outline-")) {
		const stem = primary.slice("ic:outline-".length);
		const fallback = await fetchIconifyByName(`material-symbols:${stem}`);
		if (fallback) return fallback;
	}
	const bitcoin = await fetchIconifyByName("material-symbols:currency-bitcoin");
	if (bitcoin) return bitcoin;
	throw new Error(`No icon found for ${icon}`);
};

export const buildCompositeSvg = (
	innerSvg: string,
	boosted: boolean,
): string => {
	const fill = boosted ? PIN_FILL_BOOSTED : PIN_FILL_REGULAR;
	// innerSvg is a complete <svg>...</svg> document; nesting an SVG inside an
	// outer SVG is valid and rasterizes correctly through <img>.
	return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="43" viewBox="0 0 32 43"><path d="${PIN_PATH}" fill="${fill}"/><g transform="translate(6, 5.75)">${innerSvg}</g></svg>`;
};

export const loadSvgImage = (svg: string): Promise<HTMLImageElement> =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = (err) => reject(err);
		img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
	});

// Per-map sprite-promise cache. Keyed by MapLibreMap so multiple maps in the
// same page session (e.g. /map-next + an AreaMapNext embed) don't cross-pollute
// — each map has its own image registry, so a cached "completed" promise from
// one map shouldn't short-circuit registration on another.
const spritePromisesByMap = new WeakMap<
	MapLibreMap,
	Map<string, Promise<void>>
>();

const getSpritePromises = (m: MapLibreMap): Map<string, Promise<void>> => {
	let cache = spritePromisesByMap.get(m);
	if (!cache) {
		cache = new Map();
		spritePromisesByMap.set(m, cache);
	}
	return cache;
};

export const ensureSprite = (
	m: MapLibreMap,
	icon: string,
	boosted: boolean,
): Promise<void> => {
	const name = spriteName(icon, boosted);
	if (m.hasImage(name)) return Promise.resolve();
	const cache = getSpritePromises(m);
	const existing = cache.get(name);
	if (existing) return existing;
	const promise = (async () => {
		const inner = await fetchIconInnerSvg(icon);
		const composite = buildCompositeSvg(inner, boosted);
		const img = await loadSvgImage(composite);
		if (!m.hasImage(name)) m.addImage(name, img, { pixelRatio: 1 });
		m.triggerRepaint();
	})();
	cache.set(name, promise);
	// Cache only dedupes in-flight requests; once resolved, drop the entry so a
	// subsequent setStyle() (which may evict the image) can trigger regeneration
	// instead of short-circuiting on a stale resolved promise. Errors clear too,
	// so a transient Iconify outage doesn't permanently poison the cache.
	promise.then(
		() => cache.delete(name),
		() => cache.delete(name),
	);
	return promise;
};

export const ensureSpritesForPlaces = (m: MapLibreMap, list: Place[]): void => {
	const seen = new Set<string>();
	for (const p of list) {
		if (p.deleted_at) continue;
		const icon = p.icon ?? "question_mark";
		const boosted = Boolean(isBoosted(p));
		const key = spriteName(icon, boosted);
		if (seen.has(key)) continue;
		seen.add(key);
		ensureSprite(m, icon, boosted);
	}
};

// 1×1 transparent placeholder so styleimagemissing doesn't spam warnings
// before composite sprites resolve. Each missing icon name registers the
// same blank bitmap; once the real sprite is added via addImage(), it
// replaces this stub.
export const transparentPixel = (): {
	width: number;
	height: number;
	data: Uint8Array;
} => ({
	width: 1,
	height: 1,
	data: new Uint8Array([0, 0, 0, 0]),
});

export const installPlaceholderHandler = (m: MapLibreMap): void => {
	m.on("styleimagemissing", (e) => {
		if (m.hasImage(e.id)) return;
		m.addImage(e.id, transparentPixel());
	});
};
