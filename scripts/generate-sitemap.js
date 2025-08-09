import { generateSitemap, siteUrls } from '../src/lib/utils/sitemap.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Generate sitemap and write to static directory
const sitemap = generateSitemap(siteUrls);
const outputPath = join(process.cwd(), 'static', 'sitemap.xml');

writeFileSync(outputPath, sitemap);
console.log('✅ Generated sitemap.xml at', outputPath);
