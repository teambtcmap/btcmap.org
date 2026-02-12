// Dynamic imports for browser-only map dependencies
// These packages access window/document and must be loaded client-side only
export async function loadMapDependencies() {
	// Leaflet must load first - it sets window.L
	const [leaflet, DomEvent] = await Promise.all([
		import("leaflet"),
		import("leaflet/src/dom/DomEvent"),
	]);

	// Plugins depend on window.L - load after leaflet
	// Most imports are for side effects only (setting up window.L plugins)
	const [
		_maplibreGL,
		_maplibreLeaflet,
		locateControlModule,
		_markerCluster,
		_subgroup,
	] = await Promise.all([
		import("maplibre-gl"),
		import("@maplibre/maplibre-gl-leaflet"),
		import("leaflet.locatecontrol"),
		import("leaflet.markercluster"),
		import("leaflet.featuregroup.subgroup"),
	]);

	const { LocateControl } = locateControlModule;

	return { leaflet, DomEvent, LocateControl };
}
