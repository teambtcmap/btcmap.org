<script lang="ts">
import { _ } from "svelte-i18n";

import Icon from "$components/Icon.svelte";
import { safeHttpUrl } from "$lib/safeUrl";
import type { AreaEvent, AreaPageProps } from "$lib/types";

let { data }: { data: AreaPageProps } = $props();

// The API serializes timestamps with a timezone designator (e.g. "+07:00"
// or "Z"). The upstream records the wall-clock time the organizer wrote,
// not an instant in UTC, so we treat the value as local time and drop the
// suffix entirely. Reading the components straight from the string keeps
// the display verbatim ("19:00" stays "19:00") and avoids any tz-based
// drift in the "is past" check near midnight.
type LocalDateTime = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
};

const parseLocalDateTime = (isoString: string): LocalDateTime | null => {
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

const toDate = (parts: LocalDateTime): Date =>
	new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);

const pad2 = (n: number): string => String(n).padStart(2, "0");

// The API returns 1970-01-01T00:00:00Z for events without a starts_at
// (see btcmap-api's `From<Event> for Item`: starts_at defaults to
// UNIX_EPOCH). Parsing that as a real date and rendering it would dump
// "Jan 1, 1970, 00:00" into the UI, so we treat the epoch sentinel as
// "no date" and pin it to the future block.
const isEpochSentinel = (parts: LocalDateTime): boolean =>
	parts.year === 1970 &&
	parts.month === 1 &&
	parts.day === 1 &&
	parts.hour === 0 &&
	parts.minute === 0;

// Sorted server-side via the API window (365d back + all future), but the
// API doesn't guarantee order — defensive client sort keeps the UI
// correct even if the upstream contract relaxes later. Future events come
// first (latest-first within the block so the farthest planned event is
// at the top), then past events (most-recent-first).
type AnnotatedEvent = { event: AreaEvent; isPast: boolean };

const annotatedEvents: AnnotatedEvent[] = $derived.by(() => {
	const now = Date.now();
	const future: AnnotatedEvent[] = [];
	const past: AnnotatedEvent[] = [];
	for (const event of data.events ?? []) {
		const parts = parseLocalDateTime(event.starts_at);
		if (!parts || isEpochSentinel(parts)) {
			// Unparseable or epoch-sentinel starts_at → open-ended;
			// group with future so it stays visible.
			future.push({ event, isPast: false });
			continue;
		}
		if (toDate(parts).getTime() >= now) future.push({ event, isPast: false });
		else past.push({ event, isPast: true });
	}
	const byStartDesc = (a: AnnotatedEvent, b: AnnotatedEvent) => {
		const ap = parseLocalDateTime(a.event.starts_at);
		const bp = parseLocalDateTime(b.event.starts_at);
		const aTs = ap && !isEpochSentinel(ap) ? toDate(ap).getTime() : 0;
		const bTs = bp && !isEpochSentinel(bp) ? toDate(bp).getTime() : 0;
		if (aTs !== bTs) return bTs - aTs;
		return a.event.id - b.event.id;
	};
	future.sort(byStartDesc);
	past.sort(byStartDesc);
	return [...future, ...past];
});

const formatDateRange = (event: AreaEvent): string => {
	const start = parseLocalDateTime(event.starts_at);
	if (!start || isEpochSentinel(start)) return $_("areaEvents.noDate");
	const startDateStr = new Date(
		start.year,
		start.month - 1,
		start.day,
	).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	const startStr = `${startDateStr}, ${pad2(start.hour)}:${pad2(start.minute)}`;
	const end = event.ends_at ? parseLocalDateTime(event.ends_at) : null;
	if (!end || isEpochSentinel(end)) return startStr;
	const sameDay =
		start.year === end.year &&
		start.month === end.month &&
		start.day === end.day;
	if (sameDay) {
		return `${startStr} – ${pad2(end.hour)}:${pad2(end.minute)}`;
	}
	const endDateStr = new Date(
		end.year,
		end.month - 1,
		end.day,
	).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	return `${startStr} – ${endDateStr}, ${pad2(end.hour)}:${pad2(end.minute)}`;
};
</script>

<section class="mx-auto w-full max-w-[1000px] space-y-4 text-left xl:w-[1000px]">
	{#if annotatedEvents.length === 0}
		<div class="text-center text-primary dark:text-white">
			<p class="text-xl">{$_('areaEvents.empty')}</p>
		</div>
	{:else}
		<ul class="divide-y divide-gray-200 rounded-3xl border border-gray-300 dark:divide-white/10 dark:border-white/95 dark:bg-white/10">
			{#each annotatedEvents as { event, isPast } (event.id)}
				{@const safeUrl = safeHttpUrl(event.website)}
				<li
					class="flex flex-col gap-2 p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-5 {isPast
						? 'text-gray-500 dark:text-white/40'
						: 'text-primary dark:text-white'}"
				>
					<div class="space-y-1">
						{#if safeUrl}
							<a
								href={safeUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="break-all text-lg font-semibold text-link transition-colors hover:text-hover"
							>
								{event.name}
							</a>
						{:else}
							<span class="text-lg font-semibold">{event.name}</span>
						{/if}
						{#if isPast}
							({$_('areaEvents.past')})
						{/if}
						<p class="text-sm">
							<Icon
								type="material"
								icon="event"
								w="14"
								h="14"
								class="mr-1 inline align-middle"
							/>
							{formatDateRange(event)}
						</p>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
