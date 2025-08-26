import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import data from '$lib/download-links.json';

export const GET: RequestHandler = async () => {
	// Redirect to the Mac download link
	if (data.mac) {
		throw redirect(302, data.mac);
	}

	// If no Mac link found
	return json({ error: 'Mac download link not found' }, { status: 404 });
};
