import type { AreaEvent } from "#lib/types.js";

// The API serializes timestamps with a timezone designator (e.g. "+07:00"
// or "Z"). The upstream records the wall-clock time the organizer wrote,
// not an instant in UTC, so we treat the value as local time and drop the
// suffix entirely. Reading the components straight from the string keeps
// the display verbatim ("19:00" stays "19:00") and avoids any tz-based
// drift in the "is past" check near midnight.
export type LocalDateTime = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
};

export const parseLocalDateTime = (isoString: string): LocalDateTime | null => {
	const m = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
	if (!m) return null;
	return {
		year: Number(m[1]),
		month: Number(m[2]),
		day: Number(m[3]),
		hour: Number(m[4]),
		minute: Number(m[5]),
	};
};

export const toDate = (parts: LocalDateTime): Date =>
	new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);

// The API returns 1970-01-01T00:00:00Z for events without a starts_at
// (see btcmap-api's `From<Event> for Item`: starts_at defaults to
// UNIX_EPOCH). Parsing that as a real date and rendering it would dump
// "Jan 1, 1970, 00:00" into the UI, so we treat the epoch sentinel as
// "no date" and pin it to the future block.
export const isEpochSentinel = (parts: LocalDateTime): boolean =>
	parts.year === 1970 &&
	parts.month === 1 &&
	parts.day === 1 &&
	parts.hour === 0 &&
	parts.minute === 0;

// An event is "future" until it has actually ended — prefer ends_at so a
// multi-day or still-in-progress event isn't treated as past while it's on.
// Unparseable or epoch-sentinel starts_at → open-ended, kept visible.
export const isFutureEvent = (event: AreaEvent, now: number): boolean => {
	const startParts = parseLocalDateTime(event.starts_at);
	if (!startParts || isEpochSentinel(startParts)) return true;
	const endParts = event.ends_at ? parseLocalDateTime(event.ends_at) : null;
	const endsAt = endParts && !isEpochSentinel(endParts) ? endParts : startParts;
	return toDate(endsAt).getTime() >= now;
};

// The events tab badge and the events section must agree on this count,
// so both go through isFutureEvent.
export const countFutureEvents = (events: AreaEvent[], now: number): number =>
	events.filter((event) => isFutureEvent(event, now)).length;
