import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import data from '$lib/download-links.json';

export const GET: RequestHandler = async () => {
	// Redirect to the browser extension link
	if (data.browser) {
		throw redirect(302, data.browser);
	}

	// If no browser extension link found
	return json({ error: 'Browser extension download link not found' }, { status: 404 });
};
