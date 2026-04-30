import type { PageServerLoad } from "./$types";
import type { Pleb } from "./sponsors";

const GEYSER_API = "https://api.geyser.fund/graphql";

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

		const namedFunders = funders
			.filter(
				(f): f is GeyserFunder & { user: NonNullable<GeyserFunder["user"]> } =>
					f.user !== null,
			)
			.sort((a, b) => b.amountFunded - a.amountFunded);

		// Validate all avatar URLs in parallel
		const avatars = await Promise.all(
			namedFunders.map((f) =>
				f.user.imageUrl
					? isImageUrl(f.user.imageUrl, fetch)
					: Promise.resolve(false),
			),
		);

		const plebs: Pleb[] = namedFunders.map((f, i) => ({
			name: f.user.username,
			url: `https://geyser.fund/user/${f.user.id}`,
			avatar: avatars[i] ? (f.user.imageUrl ?? undefined) : undefined,
			sats: f.amountFunded,
		}));

		return { plebs };
	} catch {
		return { plebs: [] };
	}
};
