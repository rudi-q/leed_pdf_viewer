import type { PageLoad } from './$types';

// Disable prerendering for this page since it uses browser-only APIs
export const prerender = false;
export const ssr = false;

export const load: PageLoad = async () => {
	return {
		title: 'Modify PDFs - Merge & Reorder',
		description: 'Merge multiple PDFs and reorder pages with an intuitive drag-and-drop interface',
		keywords: 'pdf merge, pdf reorder, combine pdf, rearrange pdf pages, pdf manipulation'
	};
};
