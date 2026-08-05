import { describe, expect, it } from "vitest";

import {
	buildOsmPayload,
	buildOsmPayloadBlock,
	parseOsmPayloadBlock,
} from "./osmPayload";

describe("buildOsmPayload", () => {
	it("maps wizard fields to OSM tags for a create", () => {
		const payload = buildOsmPayload("create", {
			name: "Satoshi Cafe",
			nameEn: "Satoshi Cafe",
			address: "1 Main St",
			locationDescription: "next to the gate",
			website: "https://example.com",
			phone: "+123",
			hours: "Mo-Fr 09:00-17:00",
			methods: "onchain,lightning,nfc",
			category: "cafe",
			lat: "18.2649",
			long: "98.5013",
		});

		expect(payload.action).toBe("create");
		expect(payload.category).toBe("cafe");
		expect(payload.lat).toBe(18.2649);
		expect(payload.lon).toBe(98.5013);
		expect(payload.tags).toMatchObject({
			name: "Satoshi Cafe",
			"name:en": "Satoshi Cafe",
			"addr:full": "1 Main St",
			description: "next to the gate",
			"contact:website": "https://example.com",
			"contact:phone": "+123",
			opening_hours: "Mo-Fr 09:00-17:00",
			"currency:XBT": "yes",
			"payment:onchain": "yes",
			"payment:lightning": "yes",
			"payment:lightning_contactless": "yes",
		});
		// check_date is set to today (YYYY-MM-DD).
		expect(payload.tags.check_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("omits empty fields instead of writing blank tags", () => {
		const payload = buildOsmPayload("create", {
			name: "Bar",
			category: "bar",
			website: "",
			phone: "   ",
			lat: "1",
			long: "2",
		});
		expect(payload.tags).not.toHaveProperty("contact:website");
		expect(payload.tags).not.toHaveProperty("contact:phone");
		expect(payload.tags).not.toHaveProperty("name:en");
	});

	it("does not set payment tags when no methods are given", () => {
		const payload = buildOsmPayload("create", {
			name: "Bar",
			category: "bar",
			methods: "",
			lat: "1",
			long: "2",
		});
		expect(payload.tags).not.toHaveProperty("currency:XBT");
		expect(payload.tags).not.toHaveProperty("payment:onchain");
	});

	it("captures osm element identity for an update", () => {
		const payload = buildOsmPayload("update", {
			name: "Shop",
			osmType: "node",
			osmId: "12345",
			website: "https://shop.example",
			lat: "10",
			long: "20",
		});
		expect(payload.action).toBe("update");
		expect(payload.osmType).toBe("node");
		expect(payload.osmId).toBe("12345");
	});

	it("defaults a missing update osmType to node and drops invalid types", () => {
		// No osmType given -> defaults to node.
		expect(buildOsmPayload("update", { osmId: "1" }).osmType).toBe("node");
		// A valid non-node type is preserved.
		expect(
			buildOsmPayload("update", { osmType: "way", osmId: "1" }).osmType,
		).toBe("way");
		// An unrecognized type is dropped (undefined); the OSM push treats an
		// absent osmType as a node.
		expect(
			buildOsmPayload("update", { osmType: "bogus", osmId: "1" }).osmType,
		).toBeUndefined();
	});

	it("omits coordinates when not numeric", () => {
		const payload = buildOsmPayload("create", {
			name: "X",
			category: "c",
			lat: "",
			long: "abc",
		});
		expect(payload.lat).toBeUndefined();
		expect(payload.lon).toBeUndefined();
	});
});

describe("payload block round-trip", () => {
	it("wraps a payload in delimited fences and parses it back", () => {
		const block = buildOsmPayloadBlock("create", {
			name: "Satoshi Cafe",
			category: "cafe",
			lat: "18.2649",
			long: "98.5013",
		});
		expect(block).toContain("<!--BTCMAP_OSM_PAYLOAD_START-->");
		expect(block).toContain("<!--BTCMAP_OSM_PAYLOAD_END-->");
		expect(block).toContain("```json");

		const parsed = parseOsmPayloadBlock(`Some issue text\n\n${block}\n\nmore`);
		expect(parsed).not.toBeNull();
		expect(parsed?.action).toBe("create");
		expect(parsed?.tags.name).toBe("Satoshi Cafe");
		expect(parsed?.category).toBe("cafe");
	});

	it("returns null when no block is present", () => {
		expect(parseOsmPayloadBlock("just a plain issue body")).toBeNull();
	});

	it("returns null for a malformed block", () => {
		const broken =
			"<!--BTCMAP_OSM_PAYLOAD_START-->\n```json\n{ not json }\n```\n<!--BTCMAP_OSM_PAYLOAD_END-->";
		expect(parseOsmPayloadBlock(broken)).toBeNull();
	});

	it("returns null when the action is invalid", () => {
		const bad =
			'<!--BTCMAP_OSM_PAYLOAD_START-->\n```json\n{"action":"delete","tags":{}}\n```\n<!--BTCMAP_OSM_PAYLOAD_END-->';
		expect(parseOsmPayloadBlock(bad)).toBeNull();
	});
});
