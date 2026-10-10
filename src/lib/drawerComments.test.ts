import { describe, expect, it } from "vitest";

import { displayCommentCount, planCommentsSync } from "./drawerComments.js";

const base = { id: 1, count: 0, lastFetchedId: null, addedForId: null };

describe("planCommentsSync", () => {
	it("fetches when the place has comments that are not on screen yet", () => {
		expect(planCommentsSync({ ...base, count: 3 })).toBe("fetch");
		expect(planCommentsSync({ ...base, count: 3, lastFetchedId: 2 })).toBe(
			"fetch",
		);
	});

	it("keeps the list already fetched for this place", () => {
		expect(planCommentsSync({ ...base, count: 3, lastFetchedId: 1 })).toBe(
			"keep",
		);
	});

	it("clears the list for a place with no comments", () => {
		expect(planCommentsSync(base)).toBe("clear");
		expect(planCommentsSync({ ...base, count: undefined })).toBe("clear");
		expect(planCommentsSync({ ...base, lastFetchedId: 1 })).toBe("clear");
	});

	it("keeps the list after a first comment is posted, while the record still says 0", () => {
		expect(planCommentsSync({ ...base, lastFetchedId: 1, addedForId: 1 })).toBe(
			"keep",
		);
	});

	it("only keeps it for the place the comment was posted on", () => {
		expect(planCommentsSync({ ...base, id: 2, addedForId: 1 })).toBe("clear");
	});

	it("does nothing without a merchant", () => {
		expect(planCommentsSync({ ...base, id: undefined })).toBe("keep");
		expect(planCommentsSync({ ...base, id: null, count: 5 })).toBe("keep");
	});

	it("treats 0 as a merchant id, not as no merchant", () => {
		expect(planCommentsSync({ ...base, id: 0, count: 2 })).toBe("fetch");
		expect(planCommentsSync({ ...base, id: 0 })).toBe("clear");
	});
});

describe("displayCommentCount", () => {
	it("uses the record until the list is loaded", () => {
		expect(displayCommentCount(2, 0, false)).toBe(2);
		expect(displayCommentCount(undefined, 0, false)).toBe(0);
	});

	it("lifts a stale record to the loaded list", () => {
		expect(displayCommentCount(0, 1, true)).toBe(1);
		expect(displayCommentCount(2, 3, true)).toBe(3);
	});

	it("never goes below the record", () => {
		expect(displayCommentCount(4, 0, true)).toBe(4);
	});
});
