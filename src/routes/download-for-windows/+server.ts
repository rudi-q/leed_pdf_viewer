import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import data from '$lib/download-links.json';

export const GET: RequestHandler = async () => {
	// Redirect to the Windows download link
	if (data.windows) {
		throw redirect(302, data.windows);
	}
	
	// If no Windows link found
	return json({ error: 'Windows download link not found' }, { status: 404 });
};
