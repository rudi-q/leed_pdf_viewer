// Disable prerendering for this route since it handles dynamic user-uploaded files
// and depends on sessionStorage data that's only available at runtime
export const prerender = false;
