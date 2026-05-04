import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { RequestHandler } from "./$types";

// POST /api/session/login
// Authenticates with username + password and returns a Bearer token.
// Proxies POST /v4/users/{username}/tokens to avoid CORS preflight issues.
export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: { username?: unknown; password?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, "Invalid JSON body");
	}
	if (!body || typeof body !== "object") {
		error(400, "Invalid request body");
	}
	const { username, password } = body;

	if (!username || typeof username !== "string" || username.length > 100) {
		error(400, "Missing or invalid username");
	}
	if (!password || typeof password !== "string" || password.length > 200) {
		error(400, "Missing or invalid password");
	}

	let tokenRes: Response;
	try {
		tokenRes = await fetch(
			`${API_BASE}/v4/users/${encodeURIComponent(username)}/tokens`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${password}`,
				},
				body: JSON.stringify({ label: "BTC Map Web" }),
			},
		);
	} catch (err) {
		console.error("Failed to create token:", err);
		error(502, "Failed to log in");
	}

	if (!tokenRes.ok) {
		if (tokenRes.status === 401 || tokenRes.status === 403) {
			error(401, "Invalid username or password");
		}
		console.error("Failed to create token:", tokenRes.status);
		error(502, "Failed to log in");
	}

	let tokenData: { token?: unknown };
	try {
		tokenData = (await tokenRes.json()) as { token?: unknown };
	} catch (err) {
		console.error("Failed to parse token response:", err);
		error(502, "Failed to log in");
	}
	const token = tokenData?.token;
	if (typeof token !== "string") {
		error(502, "Token creation returned no token");
	}

	return json({ token });
};
