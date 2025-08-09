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

// FAQ Schema for help pages
export interface FAQItem {
  question: string;
  answer: string;
}

export interface StructuredDataFAQ {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: {
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }[];
}

// Article Schema for blog posts
export interface StructuredDataArticle {
  '@context': 'https://schema.org';
  '@type': 'Article';
  headline: string;
  description: string;
  author: StructuredDataPerson;
  publisher: {
    '@type': 'Organization';
    name: string;
    logo: {
      '@type': 'ImageObject';
      url: string;
    };
  };
  datePublished: string;
  dateModified: string;
  url: string;
  image?: string;
  wordCount?: number;
  articleSection?: string;
  keywords?: string[];
}

// Aggregate Rating Schema
export interface StructuredDataRating {
  '@context': 'https://schema.org';
  '@type': 'AggregateRating';
  itemReviewed: {
    '@type': 'SoftwareApplication';
    name: string;
  };
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
  worstRating: number;
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

// Generate FAQ Schema
export function generateFAQSchema(faqs: FAQItem[]): StructuredDataFAQ {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

// Generate Article Schema
export function generateArticleSchema(data: {
  title: string;
  description: string;
  url: string;
  publishDate: string;
  modifiedDate?: string;
  image?: string;
  wordCount?: number;
  category?: string;
  keywords?: string[];
}): StructuredDataArticle {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.description,
    author: {
      '@type': 'Person',
      name: 'Rudi K',
      url: 'https://github.com/rudi-q',
      sameAs: [
        'https://github.com/rudi-q',
        'https://peerlist.io/rudik'
      ]
    },
    publisher: {
      '@type': 'Organization',
      name: 'LeedPDF',
      logo: {
        '@type': 'ImageObject',
        url: 'https://leed.my/logo.png'
      }
    },
    datePublished: data.publishDate,
    dateModified: data.modifiedDate || data.publishDate,
    url: data.url,
    image: data.image,
    wordCount: data.wordCount,
    articleSection: data.category,
    keywords: data.keywords
  };
}

// Generate Rating Schema (ready for when you have reviews)
export function generateRatingSchema(rating: number, reviewCount: number): StructuredDataRating {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    itemReviewed: {
      '@type': 'SoftwareApplication',
      name: 'LeedPDF'
    },
    ratingValue: rating,
    reviewCount: reviewCount,
    bestRating: 5,
    worstRating: 1
  };
}

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
  },
  '/features': {
    title: 'LeedPDF Features - PDF Annotation Tools & Capabilities',
    description: 'Discover all LeedPDF features: draw, annotate, highlight, add text, shapes, and notes to PDFs. Works on any device with mouse, touch, or stylus input.',
    url: 'https://leed.my/features'
  },
  '/use-cases': {
    title: 'LeedPDF Use Cases - Perfect for Students, Professionals & Researchers',
    description: 'Discover how students, professionals, researchers, and teams use LeedPDF for PDF annotation, review, collaboration, and digital note-taking.',
    url: 'https://leed.my/use-cases'
  },
  '/help': {
    title: 'LeedPDF Help & Documentation - Complete User Guide',
    description: 'Complete help documentation for LeedPDF. Learn how to annotate PDFs, use drawing tools, keyboard shortcuts, and advanced features.',
    url: 'https://leed.my/help'
  },
};
