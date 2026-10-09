import { isAxiosError } from "axios";

import { API_BASE } from "#lib/api-base.js";
import api from "#lib/axios.js";
import type { CurrentUser, Role } from "#lib/currentUser.js";
import { withLiteralCommas } from "#lib/literalCommas.js";
import { authHeaders } from "#lib/session.js";

import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// Community photos of a place (btcmap-api place images, #1469). The list
// call returns metadata only, so the UI can lay out exact-ratio boxes and
// fetch each image's bytes in parallel at the size it needs.

// Where the strip and viewer are shown, for analytics
export type PlacePhotoSource =
	| "merchant_page"
	| "map_drawer"
	| "area_drawer"
	| "my_photos";

// Longest side we upload. Phone photos are 4–8 MB at 12 MP; the API caps
// uploads at 10 MB decoded, and nothing we render needs more than this.
const UPLOAD_MAX_SIDE = 2048;
const UPLOAD_JPEG_QUALITY = 0.85;

export const placePhotoUrl = (
	placeId: number,
	imageId: number,
	bounds: { w?: number; h?: number } = {},
): string => {
	const params = new URLSearchParams();
	// The API answers 400 to w=0, so only forward positive bounds
	if (bounds.w && bounds.w > 0) params.set("w", String(Math.round(bounds.w)));
	if (bounds.h && bounds.h > 0) params.set("h", String(Math.round(bounds.h)));
	const query = params.toString();
	return `${API_BASE}/v4/places/${placeId}/images/${imageId}${query ? `?${query}` : ""}`;
};

const isPlaceImage = (value: unknown): value is PlaceImage => {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.id === "number" &&
		typeof candidate.width === "number" &&
		typeof candidate.height === "number" &&
		candidate.width > 0 &&
		candidate.height > 0
	);
};

// Uploader name for the photo credit; null means "Community photo". The
// name is user-chosen: render it as text only.
export const photoAuthorName = (photo: PlaceImage): string | null => {
	// Typed as a string, but only the response's top level is checked at
	// runtime: a malformed author must read as "no credit", not throw
	const name: unknown = photo.author?.name;
	return (typeof name === "string" && name.trim()) || null;
};

// Only `type=user` uploads are public here: report evidence is for
// reviewers and can show the reporter (e.g. a selfie at the storefront).
export const fetchPlacePhotos = async (
	placeId: number,
): Promise<PlaceImage[]> => {
	const res = await api.get<unknown>(
		`${API_BASE}/v4/places/${placeId}/images?type=user`,
	);
	if (!Array.isArray(res.data)) return [];
	return res.data.filter(isPlaceImage);
};

// Mirrors the API rule: the uploader may delete their own photo, admin and
// root any photo. The API still enforces it (403); this only decides
// whether to offer the action.
const MODERATOR_ROLES: readonly Role[] = ["admin", "root"];

export const canDeletePhoto = (
	photo: PlaceImage,
	user: CurrentUser | null,
): boolean => {
	if (!user) return false;
	if (user.roles.some((role) => MODERATOR_ROLES.includes(role))) return true;
	const uploaderId = photo.author?.id ?? photo.created_by;
	return uploaderId !== undefined && uploaderId === user.id;
};

export const deletePlacePhoto = async (
	placeId: number,
	imageId: number,
	token: string,
): Promise<void> => {
	await api.delete(
		`${API_BASE}/v4/places/${placeId}/images/${imageId}`,
		authHeaders(token),
	);
};

// i18n key for a failed delete: 403 means the photo isn't the caller's
// (and they're not admin/root)
export const deleteErrorKey = (
	error: unknown,
): "placePhotos.deleteForbidden" | "placePhotos.deleteFailed" =>
	isAxiosError(error) && error.response?.status === 403
		? "placePhotos.deleteForbidden"
		: "placePhotos.deleteFailed";

// "Undo" on the upload toast: delete the photos just stored, in parallel.
// removed lists the ids that are gone, so the strip drops only those;
// complete says whether every one went (success vs error toast).
export const undoUploads = async (
	placeId: number,
	imageIds: number[],
	token: string,
): Promise<{ removed: number[]; complete: boolean }> => {
	const results = await Promise.allSettled(
		imageIds.map((id) => deletePlacePhoto(placeId, id, token)),
	);
	// 404: already gone (e.g. deleted from the viewer before Undo)
	const removed = imageIds.filter((_, i) => {
		const result = results[i];
		return (
			result.status === "fulfilled" ||
			(isAxiosError(result.reason) && result.reason.response?.status === 404)
		);
	});
	return { removed, complete: removed.length === imageIds.length };
};

// The signed-in user's uploads across all places, newest first ("My photos").
// The endpoint also returns their report evidence (type "report"): leave it
// out, it isn't public, its deep link wouldn't open, and reviewers rely on
// it. Throws on an unexpected response so the page can show its error state.
export const fetchMyPlacePhotos = async (
	token: string,
): Promise<PlaceImage[]> => {
	const res = await api.get<unknown>(
		`${API_BASE}/v4/users/me/place-images`,
		authHeaders(token),
	);
	if (!Array.isArray(res.data)) {
		throw new Error("my place images returned an unexpected response");
	}
	return res.data.filter(isPlaceImage).filter((p) => p.type === "user");
};

export const uploadPlacePhoto = async (
	placeId: number,
	token: string,
	dataBase64: string,
): Promise<PlaceImage> => {
	const res = await api.post<unknown>(
		`${API_BASE}/v4/places/${placeId}/images`,
		{ data_base64: dataBase64 },
		authHeaders(token),
	);
	if (!isPlaceImage(res.data)) {
		throw new Error("place image upload returned an unexpected response");
	}
	return res.data;
};

// One pick uploads at most this many photos; the rest are dropped with a
// warning rather than queued
export const MAX_PHOTOS_PER_PICK = 5;

export const splitPick = <T>(files: T[]): { batch: T[]; dropped: number } => ({
	batch: files.slice(0, MAX_PHOTOS_PER_PICK),
	dropped: Math.max(0, files.length - MAX_PHOTOS_PER_PICK),
});

// Each photo is its own POST, all in parallel; one failure doesn't stop the
// rest. Stored photos come back newest first, the order the list API uses.
export const uploadPlacePhotos = async <T>(
	files: T[],
	upload: (file: T) => Promise<PlaceImage>,
	onSettled: () => void,
): Promise<{ stored: PlaceImage[]; failed: unknown[] }> => {
	const results = await Promise.allSettled(
		files.map(async (file) => {
			try {
				return await upload(file);
			} finally {
				onSettled();
			}
		}),
	);
	const stored: PlaceImage[] = [];
	const failed: unknown[] = [];
	for (const result of results) {
		if (result.status === "fulfilled") stored.push(result.value);
		else failed.push(result.reason);
	}
	stored.sort(
		(a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
	);
	return { stored, failed };
};

// New uploads go first. The strip may already hold them: switching places
// and back mid-upload refetches the list, and a keyed {#each} throws on a
// duplicate id, so the refetched copies give way to the fresh ones.
export const prependUploaded = (
	stored: PlaceImage[],
	current: PlaceImage[] | undefined,
): PlaceImage[] => {
	const storedIds = new Set(stored.map((photo) => photo.id));
	return [
		...stored,
		...(current ?? []).filter((photo) => !storedIds.has(photo.id)),
	];
};

// Which way a horizontal photo strip can still scroll, for its chevrons.
// abs(): right-to-left strips report a negative scrollLeft; 1px of slack
// absorbs sub-pixel rounding at either end.
export type StripScrollState = {
	canScrollBack: boolean;
	canScrollForward: boolean;
};

export const stripScrollState = ({
	scrollLeft,
	clientWidth,
	scrollWidth,
}: {
	scrollLeft: number;
	clientWidth: number;
	scrollWidth: number;
}): StripScrollState => {
	const offset = Math.abs(scrollLeft);
	return {
		canScrollBack: offset > 1,
		canScrollForward: offset + clientWidth < scrollWidth - 1,
	};
};

export const fitWithin = (
	width: number,
	height: number,
	maxSide: number,
): { width: number; height: number } => {
	const scale = Math.min(1, maxSide / Math.max(width, height));
	return {
		width: Math.round(width * scale),
		height: Math.round(height * scale),
	};
};

// Re-encode in the browser before upload. Drawing to a canvas applies the
// EXIF rotation and drops every EXIF field (GPS included) — the API stores
// uploads byte-for-byte and serves them publicly — and shrinks phone photos.
export const prepareUpload = async (file: File): Promise<string> => {
	const bitmap = await createImageBitmap(file, {
		imageOrientation: "from-image",
	});
	const { width, height } = fitWithin(
		bitmap.width,
		bitmap.height,
		UPLOAD_MAX_SIDE,
	);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas 2d context unavailable");
	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/jpeg", UPLOAD_JPEG_QUALITY),
	);
	if (!blob) throw new Error("could not encode photo");

	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
	// Strip the `data:image/jpeg;base64,` prefix
	return dataUrl.slice(dataUrl.indexOf(",") + 1);
};

// Deep links: ?photo=<image_id> opens the viewer at that photo, on the
// merchant page and in the map drawer.
export const photoIdFromSearch = (search: string): number | null => {
	const raw = new URLSearchParams(search).get("photo");
	if (!raw || !/^\d+$/.test(raw)) return null;
	const id = Number(raw);
	return id > 0 ? id : null;
};

// What a ?photo= deep link points at among a place's loaded photos: an
// index to open, or stale (not one of its public photos, so drop it)
export const deepLinkTarget = (
	photos: PlaceImage[],
	search: string,
): { index: number } | { stale: true } | null => {
	const imageId = photoIdFromSearch(search);
	if (imageId === null) return null;
	const index = photos.findIndex((p) => p.id === imageId);
	return index === -1 ? { stale: true } : { index };
};

// Path + query + hash for history.replaceState. Keeps the map's literal
// commas (?issues=a,b) like every other query-string writer.
export const withPhotoParam = (
	href: string,
	imageId: number | null,
): string => {
	const url = new URL(href);
	if (imageId === null) url.searchParams.delete("photo");
	else url.searchParams.set("photo", String(imageId));
	return withLiteralCommas(`${url.pathname}${url.search}${url.hash}`);
};

// Shared links point at the merchant page: it works without the map and
// shows the photo in context.
export const photoPagePath = (placeId: number, imageId: number): string =>
	`/merchant/${placeId}?photo=${imageId}`;

export const photoShareUrl = (
	origin: string,
	placeId: number,
	imageId: number,
): string => `${origin}${photoPagePath(placeId, imageId)}`;
