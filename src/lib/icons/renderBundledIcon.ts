import { getIconData, iconToHTML, iconToSVG, replaceIDs } from "@iconify/utils";

import { iconCollections } from "$lib/icons/bundle";

// Render one bundled icon to the exact SVG string the Iconify API would return
// for the given color and pixel size. These are the same steps the API's own
// svg route runs (getIconData → iconToSVG → iconToHTML, then swap currentColor
// for the requested color), so the output is byte-identical to a live fetch.
// Returns null when the icon isn't in the bundle, so callers fall back to the
// network. Used by the map sprite pipeline for pin glyphs and the saved badge.
export const renderBundledIcon = (
	iconifyName: string,
	color: string,
	px: number,
): string | null => {
	const idx = iconifyName.indexOf(":");
	if (idx === -1) return null;
	const set = iconCollections[iconifyName.slice(0, idx)];
	if (!set) return null;
	const data = getIconData(set, iconifyName.slice(idx + 1));
	if (!data) return null;
	const built = iconToSVG(data, { width: px, height: px });
	return iconToHTML(replaceIDs(built.body), built.attributes)
		.split("currentColor")
		.join(color);
};
