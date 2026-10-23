import { PIN_HEIGHT } from "#lib/map/maplibreSprites.js";

// Where the /map note card (#1542) sits relative to its pin, and how the map
// moves so both are in view. Desktop: the card floats above the pin.
// Mobile: it is a sheet at the bottom edge.

// Desktop card: its bottom edge sits this far above the pin's tip (clears
// the pin itself), and it keeps this margin from the map's top edge.
export const CARD_PIN_GAP = 52;
export const EDGE_MARGIN = 16;

// easeTo offset (px from the map centre) that frames the pin for a card of
// this height. The pin is anchored at its tip.
export const frameOffset = ({
	desktop,
	cardHeight,
	mapHeight,
}: {
	desktop: boolean;
	cardHeight: number;
	mapHeight: number;
}): [number, number] => {
	if (!desktop) {
		// The middle of the map left visible above the bottom card
		return [0, -cardHeight / 2 + PIN_HEIGHT / 2];
	}
	// The card fits above the pin, and the pin stays on screen
	const pinY = Math.min(
		cardHeight + CARD_PIN_GAP + EDGE_MARGIN,
		mapHeight - EDGE_MARGIN,
	);
	return [0, Math.max(pinY - mapHeight / 2, 0)];
};

// How far a desktop card above a pin at `pinY` would run past the top
// margin: the distance to move the map down, or 0 when it fits.
export const cardOverflow = ({
	cardHeight,
	pinY,
}: {
	cardHeight: number;
	pinY: number;
}): number => Math.max(cardHeight + CARD_PIN_GAP + EDGE_MARGIN - pinY, 0);
