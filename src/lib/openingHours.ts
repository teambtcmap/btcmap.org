// Day-grid model behind the opening-hours editor (salvaged from the #1135
// wizard PoC). Generates and re-parses the simple subset of OSM
// `opening_hours` syntax the editor can represent — weekday runs with one
// or more HH:MM ranges, "24/7", all-day — e.g.
// "Mo-Fr 09:00-12:00,13:00-17:00; Sa 10:00-14:00". Anything richer (public
// holidays, months, comments) is deliberately out: parse returns null and
// the editor falls back to a raw text field so nothing is lost.

export const OSM_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
export type OsmDay = (typeof OSM_DAYS)[number];

export type TimeRange = { from: string; to: string };
export type DayState = { open: boolean; is24: boolean; ranges: TimeRange[] };

export const defaultRange = (): TimeRange => ({ from: "09:00", to: "17:00" });
export const makeDefaultDays = (): DayState[] =>
	OSM_DAYS.map(() => ({ open: false, is24: false, ranges: [defaultRange()] }));

const daySpec = (d: DayState): string | null => {
	if (!d.open) return null;
	if (d.is24) return "00:00-24:00";
	const valid = d.ranges.filter((r) => r.from && r.to);
	if (valid.length === 0) return null;
	return valid.map((r) => `${r.from}-${r.to}`).join(",");
};

export const generateOpeningHours = (
	always24: boolean,
	days: DayState[],
): string => {
	if (always24) return "24/7";
	const specs = days.map(daySpec);
	const parts: string[] = [];
	let i = 0;
	while (i < OSM_DAYS.length) {
		const spec = specs[i];
		if (spec === null) {
			i++;
			continue;
		}
		// Extend a run of consecutive days sharing the same hours.
		let j = i;
		while (j + 1 < OSM_DAYS.length && specs[j + 1] === spec) j++;
		const dayPart = i === j ? OSM_DAYS[i] : `${OSM_DAYS[i]}-${OSM_DAYS[j]}`;
		parts.push(`${dayPart} ${spec}`);
		i = j + 1;
	}
	return parts.join("; ");
};

const DAY_INDEX: Record<string, number> = Object.fromEntries(
	OSM_DAYS.map((d, i) => [d, i]),
);

const expandDays = (part: string): number[] | null => {
	const out: number[] = [];
	for (const seg of part.split(",")) {
		const range = seg.split("-");
		if (range.length === 1) {
			const idx = DAY_INDEX[range[0]];
			if (idx === undefined) return null;
			out.push(idx);
		} else if (range.length === 2) {
			const a = DAY_INDEX[range[0]];
			const b = DAY_INDEX[range[1]];
			if (a === undefined || b === undefined || a > b) return null;
			for (let k = a; k <= b; k++) out.push(k);
		} else {
			return null;
		}
	}
	return out;
};

// null = not representable by the simple editor (caller keeps the raw
// string editable instead).
export const parseOpeningHours = (
	input: string,
): DayState[] | "24/7" | null => {
	const str = input.trim();
	if (str === "") return makeDefaultDays();
	if (str === "24/7") return "24/7";

	const next = makeDefaultDays();
	for (const rawToken of str.split(";")) {
		const token = rawToken.trim();
		if (token === "") continue;
		// "<days> <range>[,<range>...]"
		const m = token.match(
			/^([A-Za-z][A-Za-z,-]*)\s+((?:\d{2}:\d{2}-\d{2}:\d{2})(?:,\d{2}:\d{2}-\d{2}:\d{2})*)$/,
		);
		if (!m) return null;
		const [, dayPart, timePart] = m;
		const indices = expandDays(dayPart);
		if (!indices) return null;

		const ranges: TimeRange[] = timePart.split(",").map((r) => {
			const [from, to] = r.split("-");
			return { from, to };
		});
		const is24 =
			ranges.length === 1 &&
			ranges[0].from === "00:00" &&
			ranges[0].to === "24:00";
		for (const idx of indices) {
			next[idx] = { open: true, is24, ranges: ranges.map((r) => ({ ...r })) };
		}
	}
	return next;
};
