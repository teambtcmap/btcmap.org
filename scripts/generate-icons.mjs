// Generates the offline icon-data bundle that lets the app render map pins and
// UI icons without hitting the public Iconify API at runtime.
//
// Why: api.iconify.design serves each icon SVG from behind Cloudflare, and a
// single map load fetches 100+ pin glyphs in a burst — enough to trip a
// Cloudflare 1015 rate-limit whose 429 carries no CORS headers, so the browser
// reports a CORS failure and the pin renders blank. Baking the known icon
// vocabulary at build time removes that runtime dependency for every icon we
// can name ahead of time; anything unknown still falls back to the live API.
//
// Output: src/lib/icons/generated/iconData.json — one per-prefix IconifyJSON
// subset (`{ ic: {...}, "material-symbols": {...}, ... }`), excluded from
// biome. The map renders pin SVGs from it at runtime via @iconify/utils
// (src/lib/icons/renderBundledIcon.ts) and <Icon> loads it via addCollection
// (src/lib/icons/registerOfflineIcons.ts). Storing icon DATA once, rather than
// pre-rendered pin SVGs plus the same data again, keeps a single source.
//
// Run with `pnpm icons:generate` — deterministic and offline: it reads the
// committed pin vocabulary (scripts/pin-icons.json) and subsets the installed
// icon-set packages. Run `pnpm icons:refresh` when the vocabulary may have
// changed (a new OSM category → a new icon upstream): it rescans the places
// API once, rewrites that list, then regenerates — review the list diff before
// committing. The @iconify-json/* packages are devDependencies used only here;
// the committed JSON is what the app imports, so the production build never
// needs them (@iconify/utils IS a runtime dependency — the app renders from
// the bundle with it).

import { createRequire } from "node:module";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getIconData, getIcons } from "@iconify/utils";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const OUT_PATH = join(SRC, "lib", "icons", "generated", "iconData.json");
const VOCABULARY_PATH = join(ROOT, "scripts", "pin-icons.json");
const PLACES_ICON_FEED = "https://api.btcmap.org/v4/places?fields=icon";

// The full icon sets we subset from, keyed by Iconify prefix.
const ICON_SETS = {
	ic: require("@iconify-json/ic/icons.json"),
	"material-symbols": require("@iconify-json/material-symbols/icons.json"),
	"fa6-solid": require("@iconify-json/fa6-solid/icons.json"),
	"fa6-brands": require("@iconify-json/fa6-brands/icons.json"),
};

// The saved-badge glyph and the ultimate pin fallback are always bundled so the
// map never needs the network for them either.
const SAVED_BADGE_ICON = "ic:baseline-bookmark-added";
const BITCOIN_FALLBACK = "material-symbols:currency-bitcoin";

// Mirror of resolveMaterialIcon in src/lib/materialIcons.ts. Parsed from that
// file so the exception table stays single-sourced; the default form is fixed.
const readMaterialExceptions = () => {
	const file = readFileSync(join(SRC, "lib", "materialIcons.ts"), "utf8");
	const block = file.match(/materialExceptions[^{]*{([\s\S]*?)\n};/);
	if (!block) throw new Error("could not locate materialExceptions in materialIcons.ts");
	const exceptions = {};
	for (const [, key, value] of block[1].matchAll(/(\w+):\s*"([^"]+)"/g)) {
		exceptions[key] = value;
	}
	return exceptions;
};

const materialExceptions = readMaterialExceptions();
const resolveMaterialIcon = (icon) =>
	materialExceptions[icon] ?? `ic:outline-${icon.replaceAll("_", "-")}`;
const resolveIconifyName = (icon) =>
	resolveMaterialIcon(icon === "question_mark" ? "currency_bitcoin" : icon);

// Mirror of faBrandIcons in src/components/Icon.svelte.
const FA_BRAND_ICONS = new Set(["x-twitter", "instagram", "facebook", "twitter"]);
const resolveFaIcon = (icon) =>
	FA_BRAND_ICONS.has(icon) ? `fa6-brands:${icon}` : `fa6-solid:${icon}`;

const splitName = (iconifyName) => {
	const idx = iconifyName.indexOf(":");
	return [iconifyName.slice(0, idx), iconifyName.slice(idx + 1)];
};

const iconExists = (iconifyName) => {
	const [prefix, local] = splitName(iconifyName);
	const set = ICON_SETS[prefix];
	return set ? getIconData(set, local) !== null : false;
};

// The renderable Iconify name for a place icon, mirroring the runtime cascade
// in fetchIconInnerSvg: the resolved name, else the material-symbols variant of
// a missing `ic:outline-*`, else null (the runtime bitcoin fallback covers it).
const resolvePinName = (placeIcon) => {
	const primary = resolveIconifyName(placeIcon);
	if (iconExists(primary)) return primary;
	if (primary.startsWith("ic:outline-")) {
		const ms = `material-symbols:${primary.slice("ic:outline-".length)}`;
		if (iconExists(ms)) return ms;
	}
	return null;
};

const readPinVocabulary = () => {
	const icons = JSON.parse(readFileSync(VOCABULARY_PATH, "utf8"));
	if (!Array.isArray(icons)) throw new Error(`${VOCABULARY_PATH} is not a JSON array`);
	return icons;
};

// --refresh only: rescan the live places API for the current distinct icon
// vocabulary and rewrite the committed list. Kept off the default path so a
// normal generate stays offline and reproducible.
const refreshPinVocabulary = async () => {
	const res = await fetch(PLACES_ICON_FEED);
	if (!res.ok) throw new Error(`places feed ${res.status} from ${PLACES_ICON_FEED}`);
	const places = await res.json();
	if (!Array.isArray(places)) throw new Error("places feed did not return an array");
	const icons = new Set();
	for (const place of places) {
		if (place && typeof place.icon === "string" && place.icon) icons.add(place.icon);
	}
	const sorted = [...icons].sort();
	writeFileSync(
		VOCABULARY_PATH,
		`[\n${sorted.map((icon) => `\t${JSON.stringify(icon)}`).join(",\n")}\n]\n`,
	);
	console.info(`Refreshed scripts/pin-icons.json with ${sorted.length} icons`);
};

const walkSvelteAndTs = (dir) => {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "generated") continue;
			files.push(...walkSvelteAndTs(full));
		} else if (entry.name.endsWith(".svelte") || entry.name.endsWith(".ts")) {
			files.push(full);
		}
	}
	return files;
};

// Icon names used by <Icon> components with a static string literal. Dynamic
// `icon={…}` values can't be resolved here; the pin vocabulary covers the
// common dynamic case (merchant.icon) and anything else falls back to the live
// API. `type="fa"` selects Font Awesome, otherwise Material.
const collectUiIconifyNames = () => {
	const names = new Set();
	for (const file of walkSvelteAndTs(SRC)) {
		const source = readFileSync(file, "utf8");
		// Only real <Icon …> tags (not <IconApps>, <IconSocials>, <IconIconify>…).
		for (const [tag] of source.matchAll(/<Icon(?=[\s/>])[\s\S]*?>/g)) {
			const iconMatch = tag.match(/\bicon="([^"]+)"/);
			if (!iconMatch) continue; // dynamic icon={…}
			const icon = iconMatch[1];
			names.add(tag.includes('type="fa"') ? resolveFaIcon(icon) : resolveMaterialIcon(icon));
		}
	}
	return names;
};

const sortedJson = (obj) => {
	const sorted = {};
	for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
	return `${JSON.stringify(sorted, null, "\t")}\n`;
};

const main = async () => {
	if (process.argv.includes("--refresh")) await refreshPinVocabulary();

	const placeIcons = readPinVocabulary();
	console.info(`Loaded ${placeIcons.length} place icons from scripts/pin-icons.json`);

	// Every icon the app can name ahead of time: the pin vocabulary (resolved
	// through the same cascade the runtime uses), the saved badge, the bitcoin
	// fallback, and every static <Icon> usage.
	const names = new Set([SAVED_BADGE_ICON, BITCOIN_FALLBACK]);
	const uncovered = [];
	for (const placeIcon of placeIcons) {
		const name = resolvePinName(placeIcon);
		if (name) names.add(name);
		else uncovered.push(placeIcon);
	}
	if (uncovered.length) {
		console.warn(`${uncovered.length} pin icons fall back to bitcoin at runtime: ${uncovered.join(", ")}`);
	}
	for (const name of collectUiIconifyNames()) names.add(name);

	// Group local names by prefix and subset each icon set. getIcons drops any
	// name absent from its set (reported as not_found), which is expected for a
	// handful of UI icons whose data the API would serve on demand.
	const localsByPrefix = {};
	for (const name of names) {
		const [prefix, local] = splitName(name);
		if (!ICON_SETS[prefix]) continue;
		(localsByPrefix[prefix] ??= new Set()).add(local);
	}
	const iconData = {};
	for (const [prefix, locals] of Object.entries(localsByPrefix)) {
		// Sort the names so the subset's icon order is stable across runs,
		// keeping regenerated bundles byte-identical and their diffs meaningful.
		const subset = getIcons(ICON_SETS[prefix], [...locals].sort());
		if (!subset) throw new Error(`getIcons returned null for ${prefix}`);
		if (subset.not_found?.length) {
			console.warn(`No icon data for ${prefix}: ${subset.not_found.join(", ")}`);
			delete subset.not_found;
		}
		iconData[prefix] = subset;
		console.info(`${prefix}: ${Object.keys(subset.icons).length} icons`);
	}

	writeFileSync(OUT_PATH, sortedJson(iconData));
	console.info(`Wrote ${OUT_PATH.replace(`${ROOT}/`, "")}`);
};

await main();
