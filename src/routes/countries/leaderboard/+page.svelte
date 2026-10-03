<script lang="ts">
import AreaLeaderboardPage from "$components/leaderboard/AreaLeaderboardPage.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";
</script>

<AreaLeaderboardPage type="country">
	{#snippet actions()}
		<PrimaryButton style="md:w-[200px] mx-auto py-3 rounded-xl" link="/countries">
			{$_('countries.viewDirectory')}
		</PrimaryButton>
	{/snippet}
</AreaLeaderboardPage>
