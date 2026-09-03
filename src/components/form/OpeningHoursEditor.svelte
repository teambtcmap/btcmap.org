<script lang="ts">
import OpeningHours from "opening_hours";

import { _ } from "$lib/i18n";
import type { DayState } from "$lib/openingHours";
import {
	defaultRange,
	generateOpeningHours,
	makeDefaultDays,
	OSM_DAYS,
	parseOpeningHours,
} from "$lib/openingHours";

// Friendly editor that produces an OSM `opening_hours` string — the same
// syntax OSM editors like iD use. Supports multiple ranges per day (split
// hours / lunch breaks), all-day days and a 24/7 shortcut. Salvaged from
// the #1135 wizard PoC; the grid model lives in $lib/openingHours.
type Props = { value?: string; disabled?: boolean };
let { value = $bindable(""), disabled = false }: Props = $props();

let days: DayState[] = $state(makeDefaultDays());
let always24 = $state(false);
// When the incoming value can't be represented by the simple editor, fall
// back to a raw text field so nothing is lost.
let rawMode = $state(false);

// Guard so our own emitted value doesn't re-trigger a parse.
let lastEmitted = "";

const emit = () => {
	const next = generateOpeningHours(always24, days);
	lastEmitted = next;
	value = next;
};

// Parse an externally-supplied value: initial mount, a re-mount after the
// hosting accordion collapsed, or a future prefill.
$effect(() => {
	if (value === lastEmitted) return;
	const parsed = parseOpeningHours(value);
	if (parsed === "24/7") {
		always24 = true;
		days = makeDefaultDays();
		rawMode = false;
	} else if (parsed) {
		always24 = false;
		days = parsed;
		rawMode = false;
	} else {
		rawMode = true;
	}
	lastEmitted = value;
});

const validationError = $derived.by(() => {
	if (!value.trim()) return "";
	try {
		// Constructing throws on invalid syntax.
		new OpeningHours(value);
		return "";
	} catch {
		return $_("openingHours.invalid");
	}
});

const toggleDay = (i: number) => {
	days[i].open = !days[i].open;
	if (days[i].open && days[i].ranges.length === 0) {
		days[i].ranges = [defaultRange()];
	}
	emit();
};
const addRange = (i: number) => {
	days[i].ranges.push(defaultRange());
	emit();
};
const removeRange = (i: number, r: number) => {
	days[i].ranges.splice(r, 1);
	emit();
};
const copyFirstOpenToAll = () => {
	const source = days.find((d) => d.open);
	if (!source) return;
	days = days.map(() => ({
		open: true,
		is24: source.is24,
		ranges: source.ranges.map((range) => ({ ...range })),
	}));
	emit();
};
const leaveRawMode = () => {
	rawMode = false;
	value = "";
	lastEmitted = "";
	days = makeDefaultDays();
	always24 = false;
};

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
				onclick={leaveRawMode}
			>
				{$_('openingHours.useSimpleEditor')}
			</button>
		</div>
	{:else}
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				class="h-4 w-4 accent-link"
				bind:checked={always24}
				onchange={emit}
				{disabled}
			/>
			<span class="font-semibold">{$_('openingHours.open247')}</span>
		</label>

		{#if !always24}
			<div class="space-y-3">
				{#each days as day, i (OSM_DAYS[i])}
					<div class="flex flex-wrap items-start gap-2">
						<label class="flex w-28 items-center gap-2 pt-2">
							<input
								type="checkbox"
								class="h-4 w-4 accent-link"
								checked={day.open}
								onchange={() => toggleDay(i)}
								{disabled}
							/>
							<span>{$_(`openingHours.days.${OSM_DAYS[i]}`)}</span>
						</label>
						{#if day.open}
							<div class="flex flex-col gap-2">
								<label class="flex items-center gap-1 text-sm">
									<input
										type="checkbox"
										class="h-4 w-4 accent-link"
										bind:checked={day.is24}
										onchange={emit}
										{disabled}
									/>
									{$_('openingHours.allDay')}
								</label>
								{#if !day.is24}
									{#each day.ranges as range, r (r)}
										<div class="flex items-center gap-2">
											<input
												type="time"
												class={timeClass}
												bind:value={range.from}
												onchange={emit}
												{disabled}
												aria-label={$_('openingHours.from')}
											/>
											<span>–</span>
											<input
												type="time"
												class={timeClass}
												bind:value={range.to}
												onchange={emit}
												{disabled}
												aria-label={$_('openingHours.to')}
											/>
											{#if day.ranges.length > 1}
												<button
													type="button"
													class="px-2 text-lg text-error hover:opacity-70"
													onclick={() => removeRange(i, r)}
													{disabled}
													aria-label={$_('openingHours.removeRange')}
												>
													×
												</button>
											{/if}
										</div>
									{/each}
									<button
										type="button"
										class="self-start text-sm font-semibold text-link hover:text-hover"
										onclick={() => addRange(i)}
										{disabled}
									>
										+ {$_('openingHours.addRange')}
									</button>
								{/if}
							</div>
						{:else}
							<span class="pt-2 text-sm text-primary/60 dark:text-white/50">
								{$_('openingHours.closed')}
							</span>
						{/if}
					</div>
				{/each}
			</div>

			<button
				type="button"
				class="text-sm font-semibold text-link hover:text-hover"
				onclick={copyFirstOpenToAll}
				{disabled}
			>
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
