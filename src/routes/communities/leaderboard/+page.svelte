<script lang="ts">
import { _ } from "#lib/i18n/index.js";
import AreaLeaderboardPage from "$components/leaderboard/AreaLeaderboardPage.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
</script>

<AreaLeaderboardPage type="community">
	{#snippet actions()}
		<div>
			<PrimaryButton style="w-full md:w-[200px] mx-auto py-3 rounded-xl mb-5" link="/communities">
				{$_('communities.directory')}
			</PrimaryButton>

			<div class="flex flex-col items-center justify-center gap-5 md:flex-row">
				<PrimaryButton style="w-full md:w-[200px] py-3 rounded-xl" link="/communities/add">
					{$_('communities.addCommunity')}
				</PrimaryButton>
				<PrimaryButton style="w-full md:w-[200px] py-3 rounded-xl" link="/communities/map">
					{$_('communities.viewMap')}
				</PrimaryButton>
			</div>
		</div>
	{/snippet}
</AreaLeaderboardPage>
