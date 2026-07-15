<script lang="ts">
import OpeningHours from "opening_hours";

import { _ } from "$lib/i18n";

// Friendly editor that produces an OSM `opening_hours` string (the same syntax
// OSM editors like iD use), e.g. "Mo-Fr 09:00-12:00,13:00-17:00; Sa 10:00-14:00".
// Supports multiple time ranges per day (split hours / lunch breaks).
export let value = "";
export let disabled = false;

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

type TimeRange = { from: string; to: string };
type DayState = { open: boolean; is24: boolean; ranges: TimeRange[] };

const defaultRange = (): TimeRange => ({ from: "09:00", to: "17:00" });
const makeDefaultDays = (): DayState[] =>
	DAYS.map(() => ({ open: false, is24: false, ranges: [defaultRange()] }));

let days: DayState[] = makeDefaultDays();
let always24 = false;
// When the incoming value can't be represented by the simple editor, fall back
// to a raw text field so nothing is lost.
let rawMode = false;

// Guard so our own emitted value doesn't re-trigger a parse.
let lastEmitted = "";

// --- string generation -----------------------------------------------------
function daySpec(d: DayState): string | null {
	if (!d.open) return null;
	if (d.is24) return "00:00-24:00";
	const valid = d.ranges.filter((r) => r.from && r.to);
	if (valid.length === 0) return null;
	return valid.map((r) => `${r.from}-${r.to}`).join(",");
}

function generate(): string {
	if (always24) return "24/7";
	const specs = days.map(daySpec);
	const parts: string[] = [];
	let i = 0;
	while (i < DAYS.length) {
		const spec = specs[i];
		if (spec === null) {
			i++;
			continue;
		}
		// Extend a run of consecutive days sharing the same hours.
		let j = i;
		while (j + 1 < DAYS.length && specs[j + 1] === spec) j++;
		const dayPart = i === j ? DAYS[i] : `${DAYS[i]}-${DAYS[j]}`;
		parts.push(`${dayPart} ${spec}`);
		i = j + 1;
	}
	return parts.join("; ");
}

function emit() {
	const next = generate();
	lastEmitted = next;
	value = next;
}

// --- parsing (subset we generate) ------------------------------------------
const DAY_INDEX: Record<string, number> = Object.fromEntries(
	DAYS.map((d, i) => [d, i]),
);

function parse(input: string): DayState[] | "24/7" | null {
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
}

function expandDays(part: string): number[] | null {
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
}

// Parse an externally-supplied value (initial mount, prefill from OSM data).
$: if (value !== lastEmitted) {
	const parsed = parse(value);
	if (parsed === "24/7") {
		always24 = true;
		days = makeDefaultDays();
		rawMode = false;
	} else if (parsed) {
		always24 = false;
		days = parsed;
		rawMode = false;
	} else {
		// Unrepresentable — keep the raw string editable.
		rawMode = true;
	}
	lastEmitted = value;
}

// --- validation feedback ---------------------------------------------------
$: validationError = validate(value);
function validate(str: string): string {
	if (!str.trim()) return "";
	try {
		// Constructing throws on invalid syntax.
		new OpeningHours(str);
		return "";
	} catch {
		return $_("openingHours.invalid");
	}
}

// --- user actions ----------------------------------------------------------
function toggleDay(i: number) {
	days[i].open = !days[i].open;
	if (days[i].open && days[i].ranges.length === 0) {
		days[i].ranges = [defaultRange()];
	}
	days = days;
	emit();
}
function addRange(i: number) {
	days[i].ranges = [...days[i].ranges, defaultRange()];
	days = days;
	emit();
}
function removeRange(i: number, r: number) {
	days[i].ranges = days[i].ranges.filter((_, idx) => idx !== r);
	days = days;
	emit();
}
function copyFirstOpenToAll() {
	const source = days.find((d) => d.open);
	if (!source) return;
	days = days.map(() => ({
		open: true,
		is24: source.is24,
		ranges: source.ranges.map((r) => ({ ...r })),
	}));
	emit();
}
function onFieldChange() {
	days = days;
	emit();
}

const timeClass =
	"rounded-lg border-2 border-input p-2 text-sm focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-white/[0.15]";
</script>

<div class="space-y-3">
	{#if rawMode}
		<div>
			<p class="mb-1 text-sm text-primary/80 dark:text-white/70">
				{$_('openingHours.rawHint')}
			</p>
			<input
				type="text"
				bind:value
				{disabled}
				placeholder="Mo-Fr 09:00-17:00; Sa 10:00-14:00"
				class="w-full rounded-2xl border-2 border-input p-3 focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-white/[0.15]"
			/>
			<button
				type="button"
				class="mt-2 text-sm font-semibold text-link hover:text-hover"
				on:click={() => {
					rawMode = false;
					value = '';
					lastEmitted = '';
					days = makeDefaultDays();
					always24 = false;
				}}
			>
				{$_('openingHours.useSimpleEditor')}
			</button>
		</div>
	{:else}
		<label class="flex items-center gap-2">
			<input type="checkbox" class="h-4 w-4 accent-link" bind:checked={always24} on:change={onFieldChange} {disabled} />
			<span class="font-semibold">{$_('openingHours.open247')}</span>
		</label>

		{#if !always24}
			<div class="space-y-3">
				{#each days as day, i (DAYS[i])}
					<div class="flex flex-wrap items-start gap-2">
						<label class="flex w-28 items-center gap-2 pt-2">
							<input type="checkbox" class="h-4 w-4 accent-link" checked={day.open} on:change={() => toggleDay(i)} {disabled} />
							<span>{$_(`openingHours.days.${DAYS[i]}`)}</span>
						</label>
						{#if day.open}
							<div class="flex flex-col gap-2">
								<label class="flex items-center gap-1 text-sm">
									<input type="checkbox" class="h-4 w-4 accent-link" bind:checked={day.is24} on:change={onFieldChange} {disabled} />
									{$_('openingHours.allDay')}
								</label>
								{#if !day.is24}
									{#each day.ranges as range, r (r)}
										<div class="flex items-center gap-2">
											<input type="time" class={timeClass} bind:value={range.from} on:change={onFieldChange} {disabled} aria-label={$_('openingHours.from')} />
											<span>–</span>
											<input type="time" class={timeClass} bind:value={range.to} on:change={onFieldChange} {disabled} aria-label={$_('openingHours.to')} />
											{#if day.ranges.length > 1}
												<button type="button" class="px-2 text-lg text-error hover:opacity-70" on:click={() => removeRange(i, r)} {disabled} aria-label={$_('openingHours.removeRange')}>×</button>
											{/if}
										</div>
									{/each}
									<button type="button" class="self-start text-sm font-semibold text-link hover:text-hover" on:click={() => addRange(i)} {disabled}>
										+ {$_('openingHours.addRange')}
									</button>
								{/if}
							</div>
						{:else}
							<span class="pt-2 text-sm text-primary/60 dark:text-white/50">{$_('openingHours.closed')}</span>
						{/if}
					</div>
				{/each}
			</div>

			<button type="button" class="text-sm font-semibold text-link hover:text-hover" on:click={copyFirstOpenToAll} {disabled}>
				{$_('openingHours.copyToAll')}
			</button>
		{/if}

		<div class="rounded-lg bg-link/5 px-3 py-2 text-sm">
			<span class="text-primary/70 dark:text-white/60">{$_('openingHours.preview')}:</span>
			<code class="font-mono">{value || $_('openingHours.none')}</code>
		</div>
	{/if}

	{#if validationError}
		<p class="text-sm font-semibold text-error">{validationError}</p>
	{/if}
</div>
