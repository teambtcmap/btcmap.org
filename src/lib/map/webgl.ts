// MapLibre GL JS requires WebGL. Older Android WebViews, restricted
// enterprise browsers, privacy-hardened Firefox configurations, and
// devices with hardware acceleration disabled can all fail to provide
// a context — in which case MapLibre throws and the map container
// renders blank. Callers should check this before instantiating a Map
// and fall back to a static message instead.

export const hasWebGL = (): boolean => {
	if (typeof document === "undefined") return false;
	try {
		const canvas = document.createElement("canvas");
		const ctx =
			canvas.getContext("webgl2") ||
			canvas.getContext("webgl") ||
			canvas.getContext("experimental-webgl");
		return ctx !== null;
	} catch {
		return false;
	}
};
