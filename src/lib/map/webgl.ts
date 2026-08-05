// MapLibre GL JS v6 requires WebGL2 (WebGL1 support was removed). Older
// Android WebViews, iOS ≤14, restricted enterprise browsers,
// privacy-hardened Firefox configurations, and devices with hardware
// acceleration disabled can all fail to provide a WebGL2 context — in
// which case MapLibre throws and the map container renders blank.
// Callers should check this before instantiating a Map and fall back to
// a static message instead. Probing "webgl"/"experimental-webgl" here
// would pass on WebGL1-only devices whose map then breaks anyway.

export const hasWebGL = (): boolean => {
	if (typeof document === "undefined") return false;
	try {
		const canvas = document.createElement("canvas");
		return canvas.getContext("webgl2") !== null;
	} catch {
		return false;
	}
};
