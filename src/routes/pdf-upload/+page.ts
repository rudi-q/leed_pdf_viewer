// Disable prerendering and SSR for this route since it handles dynamic user-uploaded files
// and depends on browser-only APIs (IndexedDB, sessionStorage) that are only available at runtime
export const prerender = false;
export const ssr = false;
