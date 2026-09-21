<script lang="ts">
import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { PaymentMethod } from "$lib/map/paymentMethodFilter";

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

const ICONS: Record<PaymentMethod, string> = {
	lightning: "/icons/ln-highlight.svg",
	onchain: "/icons/btc-highlight.svg",
	nfc: "/icons/nfc-highlight.svg",
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
			{#each ORDER as method (method)}
				{@const isActive = method === active}
				<!-- 28px visual with a transparent 44px hit area behind it, so
				     the pill matches the existing control without shipping a
				     28px target into a phone sheet. -->
				<button
					type="button"
					role="radio"
					aria-checked={isActive}
					onclick={() => choose(method)}
					class="relative flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-dark {isActive
						? 'border-link bg-link/10 text-primary dark:border-link dark:text-white'
						: 'border-gray-300 text-body hover:border-link dark:border-white/20 dark:text-white/80 dark:hover:text-white'}"
				>
					<img
						src={ICONS[method]}
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
