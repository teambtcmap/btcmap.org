<script lang="ts">
import PaymentMethodPill from "$components/PaymentMethodPill.svelte";
import { _ } from "$lib/i18n";

export let onchain: "yes" | undefined = undefined;
export let lightning: "yes" | undefined = undefined;
export let contactless: "yes" | undefined = undefined;

$: hasAny = onchain === "yes" || lightning === "yes" || contactless === "yes";
</script>

{#if hasAny}
	<div>
		<span class="block text-xs text-mapLabel dark:text-white/70"
			>{$_("payment.accepts")}</span
		>
		<div class="mt-1 flex flex-wrap gap-2">
			{#if lightning === "yes"}
				<PaymentMethodPill method="ln" label={$_("payment.lightning")} />
			{/if}
			{#if onchain === "yes"}
				<PaymentMethodPill method="btc" label={$_("payment.onchain")} />
			{/if}
			{#if contactless === "yes"}
				<PaymentMethodPill
					method="nfc"
					label={$_("payment.contactless")}
				/>
			{/if}
		</div>
	</div>
{/if}
