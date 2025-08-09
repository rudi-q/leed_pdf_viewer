export interface SitemapUrl {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export function generateSitemap(urls: SitemapUrl[], baseUrl: string = 'https://leed.my'): string {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ url, lastmod, changefreq, priority }) => `  <url>
    <loc>${baseUrl}${url}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    ${changefreq ? `<changefreq>${changefreq}</changefreq>` : ''}
    ${priority ? `<priority>${priority.toFixed(1)}</priority>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;

  return sitemap;
}

export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Define your site's URLs
export const siteUrls: SitemapUrl[] = [
  {
    url: '/',
    lastmod: getCurrentDate(),
    changefreq: 'weekly',
    priority: 1.0
  },
  {
    url: '/privacy',
    lastmod: getCurrentDate(),
    changefreq: 'monthly',
    priority: 0.6
  },
  {
    url: '/downloads',
    lastmod: getCurrentDate(),
    changefreq: 'weekly',
    priority: 0.8
  }
];
