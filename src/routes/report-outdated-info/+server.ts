import { redirect } from "@sveltejs/kit";

export async function GET() {
	redirect(301, `/verify-location`);
}
