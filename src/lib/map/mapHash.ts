// URL hash viewport sync for /map-next.
//
// Format mirrors /map: `#zoom/lat/lng&merchant=123&view=…`. We extend it
// with optional `/bearing/pitch` segments after lng, written only when
// non-zero. Drawer params after `&` are preserved untouched so a shared
// URL combining a viewport + an open drawer round-trips.

export type HashCoords = {
	zoom: number;
	lat: number;
	lng: number;
	bearing: number;
	pitch: number;
};

export const parseHashCoords = (): HashCoords | null => {
	if (typeof window === "undefined") return null;
	const hash = window.location.hash.substring(1);
	const ampIndex = hash.indexOf("&");
	const coordsPart = ampIndex !== -1 ? hash.substring(0, ampIndex) : hash;
	if (!coordsPart.includes("/")) return null;
	const parts = coordsPart.split("/");
	if (parts.length < 3) return null;
	const zoom = Number.parseFloat(parts[0]);
	const lat = Number.parseFloat(parts[1]);
	const lng = Number.parseFloat(parts[2]);
	if (Number.isNaN(zoom) || Number.isNaN(lat) || Number.isNaN(lng)) return null;
	const bearing = parts[3] ? Number.parseFloat(parts[3]) : 0;
	const pitch = parts[4] ? Number.parseFloat(parts[4]) : 0;
	return {
		zoom,
		lat,
		lng,
		bearing: Number.isNaN(bearing) ? 0 : bearing,
		pitch: Number.isNaN(pitch) ? 0 : pitch,
	};
};

export const writeHashCoords = (c: HashCoords) => {
	if (typeof window === "undefined") return;
	const currentHash = window.location.hash.substring(1);
	const ampIndex = currentHash.indexOf("&");
	let existingParams = "";
	if (ampIndex !== -1 && currentHash.substring(0, ampIndex).includes("/")) {
		existingParams = currentHash.substring(ampIndex);
	} else if (!currentHash.includes("/") && currentHash.length > 0) {
		existingParams = `&${currentHash}`;
	}
	// Cascading zeros: bearing is written when EITHER bearing or pitch is
	// non-zero (so pitch always has a slot before it); pitch only when
	// non-zero. `15/40/-74` and `15/40/-74/0` therefore decode identically
	// — fine because the writer never produces the second form.
	let coordsPart = `${c.zoom.toFixed(2)}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`;
	if (c.bearing !== 0 || c.pitch !== 0) {
		coordsPart += `/${c.bearing.toFixed(1)}`;
	}
	if (c.pitch !== 0) {
		coordsPart += `/${c.pitch.toFixed(1)}`;
	}
	const newHash = `#${coordsPart}${existingParams}`;
	const search = window.location.search || "";
	const url = window.location.pathname + search + newHash;
	history.replaceState(history.state, "", url);
};
