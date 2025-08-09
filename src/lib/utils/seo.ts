export interface SEOData {
  title: string;
  description: string;
  keywords?: string;
  author?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  robots?: string;
}

export interface StructuredDataPerson {
  '@type': 'Person';
  name: string;
  url?: string;
  sameAs?: string[];
}

export interface StructuredDataSoftware {
  '@context': 'https://schema.org';
  '@type': 'SoftwareApplication';
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  author: StructuredDataPerson;
  offers?: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
  };
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: number;
    reviewCount: number;
  };
  screenshot?: string;
  softwareVersion?: string;
  downloadUrl?: string;
  license?: string;
}

export const defaultSEOData: SEOData = {
  title: 'LeedPDF - Draw on PDFs | Free PDF Annotation Tool',
  description: 'Add drawings and notes to any PDF with LeedPDF. Free, browser-based PDF annotation tool that works on any device. No uploads required - your files stay private.',
  keywords: 'PDF annotation, PDF editor, draw on PDF, PDF markup, free PDF tool, browser PDF editor, PDF notes, digital annotation',
  author: 'Rudi K',
  image: 'https://leed.my/logo.png',
  url: 'https://leed.my',
  type: 'website',
  twitterCard: 'summary_large_image',
  robots: 'index, follow'
};

export function generateMetaTags(seoData: Partial<SEOData> = {}): string {
  const data = { ...defaultSEOData, ...seoData };
  
  return `
    <!-- Primary Meta Tags -->
    <title>${data.title}</title>
    <meta name="title" content="${data.title}">
    <meta name="description" content="${data.description}">
    <meta name="keywords" content="${data.keywords}">
    <meta name="author" content="${data.author}">
    <meta name="robots" content="${data.robots}">
    <link rel="canonical" href="${data.url}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${data.type}">
    <meta property="og:url" content="${data.url}">
    <meta property="og:title" content="${data.title}">
    <meta property="og:description" content="${data.description}">
    <meta property="og:image" content="${data.image}">
    <meta property="og:site_name" content="LeedPDF">
    <meta property="og:locale" content="en_US">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="${data.twitterCard}">
    <meta property="twitter:url" content="${data.url}">
    <meta property="twitter:title" content="${data.title}">
    <meta property="twitter:description" content="${data.description}">
    <meta property="twitter:image" content="${data.image}">
    <meta property="twitter:creator" content="@rudikq">
    <meta property="twitter:site" content="@leedpdf">
    
    <!-- Additional SEO -->
    <meta name="theme-color" content="#8B9474">
    <meta name="msapplication-TileColor" content="#8B9474">
    <meta name="application-name" content="LeedPDF">
    <meta name="apple-mobile-web-app-title" content="LeedPDF">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    
    <!-- Preconnect to external domains -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://peerlist.io">
    
    <!-- DNS prefetch for performance -->
    <link rel="dns-prefetch" href="//github.com">
    <link rel="dns-prefetch" href="//leed.my">
  `.trim();
}

export function generateLDJSON(data: StructuredDataSoftware): string {
  return JSON.stringify(data, null, 2);
}

export const softwareApplicationData: StructuredDataSoftware = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'LeedPDF',
  description: 'A modern, open-source PDF annotation tool that runs entirely in your browser. Draw, annotate, and collaborate without uploading your documents to external servers.',
  url: 'https://leed.my',
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Web Browser, Windows, macOS, Linux, iOS, Android',
  author: {
    '@type': 'Person',
    name: 'Rudi K',
    url: 'https://github.com/rudi-q',
    sameAs: [
      'https://github.com/rudi-q',
      'https://peerlist.io/rudik'
    ]
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  },
  screenshot: 'https://leed.my/screenshot.png',
  softwareVersion: '0.0.1',
  downloadUrl: 'https://leed.my/downloads',
  license: 'https://opensource.org/licenses/MIT'
};

// SEO data for different pages
export const pageSEOData: Record<string, Partial<SEOData>> = {
  '/': {
    title: 'LeedPDF - Draw on PDFs | Free PDF Annotation Tool',
    description: 'Add drawings and notes to any PDF with LeedPDF. Free, browser-based PDF annotation tool that works on any device. No uploads required - your files stay private.',
    url: 'https://leed.my'
  },
  '/privacy': {
    title: 'Privacy Policy - LeedPDF',
    description: 'Learn about LeedPDF\'s privacy-first approach. All PDF processing happens locally in your browser - no uploads, no tracking, no accounts required.',
    url: 'https://leed.my/privacy'
  },
  '/downloads': {
    title: 'Download LeedPDF - Desktop & Mobile Apps',
    description: 'Download LeedPDF for desktop (Windows, Mac, Linux) or use it directly in your browser. Free PDF annotation tool available on all platforms.',
    url: 'https://leed.my/downloads'
  }
};
