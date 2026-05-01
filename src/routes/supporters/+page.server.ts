import type { PageServerLoad } from "./$types";
import type { Pleb } from "./sponsors";

const GEYSER_API = "https://api.geyser.fund/graphql";

// Users excluded from the leaderboard (platform/project accounts)
const EXCLUDED_USER_IDS = new Set(["995", "641"]); // BTC Map, Geyser

const QUERY = `{
  projectGet(where: { name: "btcmap" }) {
    funders {
      amountFunded
      user {
        id
        username
        imageUrl
      }
    }
  }
}`;

type GeyserFunder = {
	amountFunded: number;
	user: {
		id: string;
		username: string;
		imageUrl: string | null;
	} | null;
};

type GeyserResponse = {
	data: {
		projectGet: {
			funders: GeyserFunder[];
		};
	};
};

async function isImageUrl(
	url: string,
	fetch: typeof globalThis.fetch,
): Promise<boolean> {
	try {
		const res = await fetch(url, { method: "HEAD" });
		const contentType = res.headers.get("content-type") ?? "";
		return res.ok && contentType.startsWith("image/");
	} catch {
		return false;
	}
}

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch(GEYSER_API, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query: QUERY }),
		});

		if (!res.ok) {
			return { plebs: [] };
		}

		const json: GeyserResponse = await res.json();
		const funders = json.data?.projectGet?.funders ?? [];

		// Separate anon and named funders, excluding platform accounts
		const anonTotal = funders
			.filter((f) => f.user === null)
			.reduce((sum, f) => sum + f.amountFunded, 0);

		const namedFunders = funders
			.filter(
				(f): f is GeyserFunder & { user: NonNullable<GeyserFunder["user"]> } =>
					f.user !== null && !EXCLUDED_USER_IDS.has(f.user.id),
			)
			.sort((a, b) => b.amountFunded - a.amountFunded);

		// Validate avatar URLs in parallel; fall back to robohash for missing ones
		const avatars = await Promise.all(
			namedFunders.map((f) =>
				f.user.imageUrl
					? isImageUrl(f.user.imageUrl, fetch)
					: Promise.resolve(false),
			),
		);

		const namedPlebs: Pleb[] = namedFunders.map((f, i) => ({
			name: f.user.username,
			url: `https://geyser.fund/user/${f.user.id}`,
			avatar: avatars[i]
				? (f.user.imageUrl ?? undefined)
				: `https://robohash.org/${f.user.id}?set=set1&size=64x64`,
			sats: f.amountFunded,
		}));

		// Add anon aggregate entry at the correct position by sats
		const anonPleb: Pleb = {
			name: "Anon",
			avatar: "/images/satoshi-nakamoto.png",
			sats: anonTotal,
		};

		const allPlebs = [...namedPlebs, anonPleb].sort(
			(a, b) => (b.sats ?? 0) - (a.sats ?? 0),
		);

		return { plebs: allPlebs };
	} catch {
		return { plebs: [] };
	}
};
