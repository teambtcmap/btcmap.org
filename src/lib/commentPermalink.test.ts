import { describe, expect, it } from "vitest";

import { commentAnchorFromHash, commentDomId } from "./commentPermalink";

describe("commentDomId", () => {
	it("builds the DOM id for a comment", () => {
		expect(commentDomId(123)).toBe("comment-123");
	});
});

describe("commentAnchorFromHash", () => {
	it("parses a comment permalink hash into its DOM id", () => {
		expect(commentAnchorFromHash("#comment-123")).toBe("comment-123");
	});

	it("round-trips an id built by commentDomId", () => {
		expect(commentAnchorFromHash(`#${commentDomId(42)}`)).toBe(
			commentDomId(42),
		);
	});

	it("ignores the existing #comments tab deep-link", () => {
		expect(commentAnchorFromHash("#comments")).toBeNull();
	});

	it("ignores an empty hash", () => {
		expect(commentAnchorFromHash("")).toBeNull();
	});

	it("ignores a bare #comment- prefix without an id", () => {
		expect(commentAnchorFromHash("#comment-")).toBeNull();
	});

	it("ignores non-numeric ids", () => {
		expect(commentAnchorFromHash("#comment-12abc")).toBeNull();
		expect(commentAnchorFromHash("#comment-abc")).toBeNull();
	});

	it("ignores unrelated hashes", () => {
		expect(commentAnchorFromHash("#panel-activity")).toBeNull();
	});

	it("requires the pattern to span the whole hash", () => {
		// pins the regex's left anchor: a valid-looking suffix is not enough
		expect(commentAnchorFromHash("##comment-1")).toBeNull();
	});

	it("is case-sensitive", () => {
		expect(commentAnchorFromHash("#Comment-1")).toBeNull();
	});
});
