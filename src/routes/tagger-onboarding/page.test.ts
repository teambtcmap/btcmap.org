import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";

import { load } from "./+page";

describe("/tagger-onboarding redirect", () => {
	it("permanently redirects to the join-us guide", () => {
		try {
			load({} as Parameters<typeof load>[0]);
		} catch (err) {
			if (!isRedirect(err)) throw err;
			expect(err.status).toBe(301);
			expect(err.location).toBe("/join-us");
			return;
		}
		throw new Error("expected /tagger-onboarding to redirect");
	});
});
