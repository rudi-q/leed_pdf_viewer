import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DOWNLOAD_URL } from './constants';

export const load: PageServerLoad = () => {
    redirect(308, DOWNLOAD_URL);
};
