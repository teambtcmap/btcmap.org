<script lang="ts">
import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { PaymentMethod } from "$lib/map/paymentMethodFilter";
import { theme } from "$lib/theme";

// The payment switcher that rides the empty-state note (#1430). The note
// tells the reader the view is filtered; without this it gives them no way
// to act on that, and their question is "what DO they take here?" rather
// than "how do I clear this filter?".
//
// Markup is IssueFilterChips' bar, deliberately: two zones, with only the
// method pills in the overflow-x-auto track and the exit rendered outside
// it as shrink-0, so the way out can never be the thing that scrolled off.
// The selection model is NOT shared — issue codes are OR'd, payment
// methods are AND'd by applyPaymentMethodFilter, so this is single-select.
// Tapping a method replaces the current one; tapping the active one is a
// no-op, because it is a radio and not a toggle.
type Props = {
	// The method the URL currently describes, or null — either an
	// unfiltered view or a hand-written multi-param URL that no single
	// option can represent.
	active: PaymentMethod | null;
	onselect: (method: PaymentMethod | null) => void;
	class?: string;
};
let { active, onselect, class: className = "" }: Props = $props();

// The -highlight glyphs are stroked #1C4347, which is all but invisible on
// the dark card, so they swap by theme exactly as PaymentMethodPill does.
// IssueFilterChips, whose markup this borrows, uses theme-independent
// colour dots and so never needed this.
const ICONS: Record<PaymentMethod, { light: string; dark: string }> = {
	lightning: {
		light: "/icons/ln-highlight.svg",
		dark: "/icons/ln-highlight-dark.svg",
	},
	onchain: {
		light: "/icons/btc-highlight.svg",
		dark: "/icons/btc-highlight-dark.svg",
	},
	nfc: {
		light: "/icons/nfc-highlight.svg",
		dark: "/icons/nfc-highlight-dark.svg",
	},
};

// Reuses the add-location form's labels rather than minting parallel
// strings for the same three concepts.
const LABEL_KEYS: Record<PaymentMethod, string> = {
	lightning: "addLocation.lightningLabel",
	onchain: "addLocation.onchainLabel",
	nfc: "addLocation.nfcLabel",
};

// Ordered so the methods people actually record come first: lightning is
// on 79% of live places, onchain 40%, contactless 12%.
const ORDER: readonly PaymentMethod[] = ["lightning", "onchain", "nfc"];

const choose = (method: PaymentMethod) => {
	if (method === active) return;
	trackEvent("payment_switch", { method });
	onselect(method);
};

// role="radio" promises the radiogroup keyboard contract, so it has to be
// kept: one stop in the tab order and arrows moving between the options.
// Without this the role was a lie — three tab stops and dead arrow keys.
// (IssueFilterChips sidesteps it with aria-pressed toggles, but these are
// mutually exclusive, so radio is the right role.)
//
// Arrows move focus WITHOUT selecting, and Space/Enter commits. Selection
// here is a full page navigation, so the usual selection-follows-focus
// variant would reload the map on every arrow press and throw focus away
// — ARIA allows this variant precisely when selection is expensive.
let pills = $state<HTMLButtonElement[]>([]);

// The tab stop starts on the checked option, or the first one when a
// hand-written multi-param URL leaves none checked — never "no stop at
// all" — and then follows the arrows so tabbing away and back returns to
// where the user was.
let focused = $state<number | null>(null);
const focusIndex = $derived(
	focused ?? Math.max(ORDER.indexOf(active as PaymentMethod), 0),
);

const onKeydown = (event: KeyboardEvent, index: number) => {
	const step =
		event.key === "ArrowRight" || event.key === "ArrowDown"
			? 1
			: event.key === "ArrowLeft" || event.key === "ArrowUp"
				? -1
				: event.key === "Home"
					? -index
					: event.key === "End"
						? ORDER.length - 1 - index
						: 0;
	if (step === 0 && event.key !== "Home" && event.key !== "End") return;
	event.preventDefault();
	const next = (index + step + ORDER.length) % ORDER.length;
	focused = next;
	pills[next]?.focus();
};

const showAll = () => {
	trackEvent("payment_show_all");
	onselect(null);
};
</script>

<!-- Wraps instead of scrolling from md up. The desktop card is a fixed
     320px, which fits neither three method pills nor three plus the exit on
     one line. Scrolling is the mobile answer, where the fade and chevron
     say so; on desktop the bar stacks and the card grows instead.
     The track must stay width-bounded by the card here (w-full, not an
     auto width): sized to its content it simply spilled the last pill out
     over the map. -->
<div class="flex items-center gap-2 md:flex-col md:items-start {className}">
	<div class="relative min-w-0 flex-1 md:w-full md:flex-none">
		<div
			role="radiogroup"
			aria-label={$_('paymentSwitch.label')}
			class="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible"
		>
			{#each ORDER as method, index (method)}
				{@const isActive = method === active}
				<!-- 28px visual with a transparent 44px hit area behind it, so
				     the pill matches the existing control without shipping a
				     28px target into a phone sheet. -->
				<button
					bind:this={pills[index]}
					type="button"
					role="radio"
					aria-checked={isActive}
					tabindex={index === focusIndex ? 0 : -1}
					onclick={() => choose(method)}
					onkeydown={(event) => onKeydown(event, index)}
					class="relative flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-dark {isActive
						? 'border-link bg-link/10 text-primary dark:border-link dark:text-white'
						: 'border-gray-300 text-body hover:border-link dark:border-white/20 dark:text-white/80 dark:hover:text-white'}"
				>
					<img
						src={$theme === "dark" ? ICONS[method].dark : ICONS[method].light}
						alt=""
						class="h-4 w-4 shrink-0 {isActive ? '' : 'opacity-40'}"
					/>
					<span>{$_(LABEL_KEYS[method])}</span>
				</button>
			{/each}
		</div>
		<!-- Sideways-scroll affordance, mobile only: at 320px the desktop bar
		     fits all three without scrolling. -->
		<div
			class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-white md:hidden dark:to-dark"
		></div>
		<div class="pointer-events-none absolute top-1/2 right-1 -translate-y-[60%] md:hidden">
			<Icon
				w="14"
				h="14"
				icon="chevron_right"
				type="material"
				class="text-body/60 dark:text-white/50"
			/>
		</div>
	</div>
	<!-- Outside the scrolling track on purpose: the exit is the one control
	     that must never scroll out of reach on an empty view. -->
	<button
		type="button"
		onclick={showAll}
		class="relative flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 text-xs font-semibold whitespace-nowrap text-body transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:border-link hover:text-link focus-visible:ring-2 focus-visible:ring-link focus-visible:outline-none dark:border-white/20 dark:bg-white/5 dark:text-white/80 dark:hover:border-link dark:hover:text-white"
	>
		<Icon w="12" h="12" icon="close" type="material" />
		{$_('paymentSwitch.showAll')}
	</button>
</div>
