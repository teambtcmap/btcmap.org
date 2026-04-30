import type { PageServerLoad } from "./$types";
import type { Pleb } from "./sponsors";

const GEYSER_API = "https://api.geyser.fund/graphql";

const QUERY = `{
  projectGet(where: { name: "btcmap" }) {
    funders {
      amountFunded
      user {
        username
        imageUrl
      }
    }
  }
}`;

type GeyserFunder = {
	amountFunded: number;
	user: {
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

		const plebs: Pleb[] = funders
			.filter(
				(f): f is GeyserFunder & { user: NonNullable<GeyserFunder["user"]> } =>
					f.user !== null,
			)
			.sort((a, b) => b.amountFunded - a.amountFunded)
			.map((f) => ({
				name: f.user.username,
				url: `https://geyser.fund/profile/${f.user.username}`,
				avatar: f.user.imageUrl ?? undefined,
			}));

		return { plebs };
	} catch {
		return { plebs: [] };
	}
};
