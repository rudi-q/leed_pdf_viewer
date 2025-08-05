<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, Calendar, Tag, ExternalLink } from 'lucide-svelte';
  import { browser } from '$app/environment';

  interface Asset {
    name: string;
    browser_download_url: string;
    size: number;
    download_count: number;
  }

  interface Release {
    name: string;
    tag_name: string;
    body: string;
    published_at: string;
    assets: Asset[];
    prerelease: boolean;
    draft: boolean;
  }

  let releases: Release[] = [];
  let error = '';
  let loading = true;
  let userOS = 'Unknown';
  let recommendedAsset: Asset | null = null;

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function getPlatformIcon(fileName: string): string {
    if (fileName.includes('windows') || fileName.includes('.exe') || fileName.includes('.msi')) {
      return '🪟';
    } else if (fileName.includes('mac') || fileName.includes('darwin') || fileName.includes('.dmg')) {
      return '🍎';
    } else if (fileName.includes('linux') || fileName.includes('.deb') || fileName.includes('.rpm') || fileName.includes('.AppImage')) {
      return '🐧';
    }
    return '📦';
  }

  function getPlatformName(fileName: string): string {
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.includes('.exe')) {
      return 'Windows App - Fast Installer for Windows';
    } else if (lowerName.includes('.msi')) {
      return 'Windows App - Microsoft Installer';
    } else if (lowerName.includes('windows')) {
      return 'Windows App';
    } else if (lowerName.includes('.dmg')) {
      return 'Mac App - macOS Installation';
    } else if (lowerName.includes('mac') || lowerName.includes('darwin')) {
      return 'Mac App';
    } else if (lowerName.includes('.deb')) {
      return 'Linux App - Debian Package';
    } else if (lowerName.includes('.rpm')) {
      return 'Linux App - Red Hat Package';
    } else if (lowerName.includes('.appimage')) {
      return 'Linux App - Portable AppImage';
    } else if (lowerName.includes('linux')) {
      return 'Linux App';
    }
    return 'Download';
  }

  function detectOS(): string {
    if (typeof window === 'undefined') return 'Unknown';
    
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    
    if (userAgent.includes('Windows') || platform.includes('Win')) {
      return 'Windows';
    } else if (userAgent.includes('Mac') || platform.includes('Mac')) {
      return 'macOS';
    } else if (userAgent.includes('Linux') || platform.includes('Linux')) {
      return 'Linux';
    }
    return 'Unknown';
  }

  function getOSIcon(os: string): string {
    switch (os) {
      case 'Windows': return '🪟';
      case 'macOS': return '🍎';
      case 'Linux': return '🐧';
      default: return '💻';
    }
  }

  function isPlatformMatch(fileName: string, os: string): boolean {
    const lowerName = fileName.toLowerCase();
    
    const osKeywords = {
      'Windows': ['windows', '.exe', '.msi'],
      'macOS': ['mac', 'darwin', '.dmg'],
      'Linux': ['linux', '.deb', '.rpm', '.appimage']
    };
    
    const keywords = osKeywords[os as keyof typeof osKeywords];
    if (!keywords) return false;
    
    return keywords.some(keyword => lowerName.includes(keyword.toLowerCase()));
  }

  function findRecommendedAsset(assets: Asset[], os: string): Asset | null {
    if (!assets.length) return null;
    
    const osKeywords = {
      'Windows': ['windows', '.exe', '.msi'],
      'macOS': ['mac', 'darwin', '.dmg'],
      'Linux': ['linux', '.deb', '.rpm', '.AppImage']
    };
    
    const keywords = osKeywords[os as keyof typeof osKeywords];
    if (!keywords) return assets[0]; // fallback to first asset
    
    return assets.find(asset => 
      keywords.some(keyword => asset.name.toLowerCase().includes(keyword.toLowerCase()))
    ) || assets[0];
  }

  function renderMarkdown(text: string): string {
    return text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
  }

  onMount(async () => {
    // Detect user's OS
    userOS = detectOS();
    
    try {
      const response = await fetch('https://api.github.com/repos/rudi-q/leed_pdf_viewer/releases');
      if (!response.ok) throw new Error('Failed to fetch releases');
      const data = await response.json();
      // Filter out draft releases and sort by published date
      releases = data.filter((release: Release) => !release.draft)
                    .sort((a: Release, b: Release) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
      
      // Find recommended asset for user's OS from the most recent release that has their platform
      if (releases.length > 0) {
        // First try to find the user's platform in any release, starting with the latest
        for (const release of releases) {
          const platformAsset = findRecommendedAsset(release.assets, userOS);
          // Only use this asset if it actually matches the user's platform
          if (platformAsset && isPlatformMatch(platformAsset.name, userOS)) {
            recommendedAsset = platformAsset;
            break;
          }
        }
        // If no platform-specific asset found, fall back to first asset of latest release
        if (!recommendedAsset && releases[0].assets.length > 0) {
          recommendedAsset = releases[0].assets[0];
        }
      }
    } catch (err) {
      console.error('Error fetching releases:', err);
      error = 'Could not load releases. Please try again later.';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Download LeedPDF - Free PDF Editor for {userOS !== 'Unknown' ? userOS : 'Windows, macOS & Linux'}</title>
  <meta name="description" content="Download LeedPDF - Free, fast, and powerful PDF editor with drawing capabilities. Available for Windows, macOS, and Linux." />
</svelte:head>

<main class="w-full">
  <!-- Header -->
  <div class="header">
    <div class="container">
      <div class="header-content">
        <img src="/favicon.png" alt="LeedPDF" class="logo" />
        <h1 class="title">Download LeedPDF on {userOS !== 'Unknown' ? userOS : 'Windows, macOS & Linux'}</h1>
        <p class="subtitle">Free, fast, and powerful PDF editor with drawing capabilities</p>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="container content">
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading releases...</p>
      </div>
    {:else if error}
      <div class="error-card">
        <div class="error-icon">⚠️</div>
        <h2>Unable to Load Releases</h2>
        <p>{error}</p>
        <a href="https://github.com/rudi-q/leed_pdf_viewer/releases" target="_blank" class="primary-button">
          <ExternalLink size={16} />
          View on GitHub
        </a>
      </div>
    {:else if releases.length === 0}
      <div class="error-card">
        <div class="error-icon">📦</div>
        <h2>No Releases Available</h2>
        <p>No releases have been published yet.</p>
      </div>
    {:else}
      <!-- Recommended Download Section -->
      {#if recommendedAsset && userOS !== 'Unknown'}
        <div class="recommended-download">
          <div class="recommended-header">
            <h2>Download for {userOS}</h2>
            <p>We've detected your operating system and recommend this version:</p>
          </div>
          <a href={recommendedAsset.browser_download_url} class="recommended-button" target="_blank">
            <div class="recommended-icon">
              {getOSIcon(userOS)}
            </div>
            <div class="recommended-info">
              <div class="recommended-title">Download LeedPDF for {userOS}</div>
              <div class="recommended-details">{recommendedAsset.name} • {formatFileSize(recommendedAsset.size)}</div>
            </div>
            <Download size={24} class="recommended-arrow" />
          </a>
        </div>
      {/if}

      <div class="releases-grid">
        {#each releases as release, index}
          <div class="release-card" class:latest={index === 0}>
            {#if index === 0}
              <div class="latest-badge">Latest Release</div>
            {/if}
            {#if release.prerelease}
              <div class="prerelease-badge">Pre-release</div>
            {/if}
            
            <div class="release-header">
              <div class="release-title">
                <Tag size={20} class="tag-icon" />
                <h2>{release.name || release.tag_name}</h2>
              </div>
              <div class="release-meta">
                <Calendar size={14} />
                <span>{formatDate(release.published_at)}</span>
              </div>
            </div>

            {#if release.body}
              <div class="release-notes">
                {@html renderMarkdown(release.body.split('\n')[0])}
                {#if release.body.split('\n').length > 1}
                  <details>
                    <summary>Show more</summary>
                    <div class="release-notes-full">
                      {@html renderMarkdown(release.body.split('\n').slice(1).join('\n'))}
                    </div>
                  </details>
                {/if}
              </div>
            {/if}

            {#if release.assets.length > 0}
              <div class="downloads">
                <h3>Downloads</h3>
                <div class="download-grid">
                  {#each release.assets as asset}
                    <a href={asset.browser_download_url} class="download-item" target="_blank">
                      <div class="download-icon">
                        {getPlatformIcon(asset.name)}
                      </div>
                      <div class="download-info">
                        <div class="download-name">{getPlatformName(asset.name)}</div>
                        <div class="download-filename">{asset.name}</div>
                        <div class="download-meta">
                          <span class="download-size">{formatFileSize(asset.size)}</span>
                          {#if asset.download_count}
                            <span class="download-count">• {asset.download_count.toLocaleString()} downloads</span>
                          {/if}
                        </div>
                      </div>
                      <Download size={20} class="download-arrow" />
                    </a>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  :global(html) {
    height: auto;
    min-height: 100%;
    overflow-y: auto !important;
  }

  :global(body) {
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
    height: auto;
    min-height: 100%;
    overflow: visible !important;
  }

  main {
    background: linear-gradient(135deg, #FDF6E3 0%, #F7F3E9 50%, #F0EFEB 100%);
    min-height: 100vh;
    width: 100%;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .header {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(52, 73, 94, 0.1);
    padding: 2rem 0;
  }

  .header-content {
    text-align: center;
  }

  .logo {
    width: 64px;
    height: 64px;
    margin-bottom: 1rem;
  }

  .title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #34495e;
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    font-size: 1.2rem;
    color: #7f8c8d;
    margin: 0;
  }

  .content {
    padding: 3rem 0;
  }

  .loading {
    text-align: center;
    padding: 4rem 0;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e8f5e8;
    border-left: 4px solid #27ae60;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-card {
    background: white;
    border-radius: 16px;
    padding: 3rem;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    max-width: 500px;
    margin: 0 auto;
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .error-card h2 {
    color: #34495e;
    margin-bottom: 1rem;
  }

  .error-card p {
    color: #7f8c8d;
    margin-bottom: 2rem;
  }

  .primary-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #27ae60;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .primary-button:hover {
    background: #219a52;
    transform: translateY(-1px);
  }

  .releases-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 2rem;
  }

  .release-card {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    position: relative;
    border: 2px solid transparent;
  }

  .release-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  }

  .release-card.latest {
    border-color: #27ae60;
    box-shadow: 0 4px 20px rgba(39, 174, 96, 0.15);
  }

  .latest-badge {
    position: absolute;
    top: -10px;
    right: 1rem;
    background: #27ae60;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .prerelease-badge {
    position: absolute;
    top: -10px;
    left: 1rem;
    background: #f39c12;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .release-header {
    margin-bottom: 1.5rem;
  }

  .release-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .release-title h2 {
    color: #34495e;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .tag-icon {
    color: #7f8c8d;
  }

  .release-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #7f8c8d;
    font-size: 0.9rem;
  }

  .release-notes {
    margin-bottom: 2rem;
    color: #5a6c7d;
    line-height: 1.6;
  }

  .release-notes p {
    margin: 0 0 0.5rem 0;
  }

  .release-notes details {
    margin-top: 1rem;
  }

  .release-notes summary {
    color: #27ae60;
    cursor: pointer;
    font-weight: 500;
  }

  .release-notes-full {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #ecf0f1;
  }

  .downloads h3 {
    color: #34495e;
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .download-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .download-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .download-item:hover {
    background: #e8f5e8;
    border-color: #27ae60;
    transform: translateX(4px);
  }

  .download-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .download-info {
    flex: 1;
  }

  .download-name {
    font-weight: 600;
    color: #34495e;
    margin-bottom: 0.25rem;
  }

  .download-filename {
    font-size: 0.9rem;
    color: #7f8c8d;
    margin-bottom: 0.25rem;
  }

  .download-meta {
    font-size: 0.8rem;
    color: #95a5a6;
  }

  .download-arrow {
    color: #27ae60;
    transition: transform 0.2s ease;
  }

  .download-item:hover .download-arrow {
    transform: translateX(4px);
  }

  /* Recommended Download Section */
  .recommended-download {
    background: white;
    border-radius: 20px;
    padding: 2.5rem;
    margin-bottom: 3rem;
    box-shadow: 0 8px 30px rgba(39, 174, 96, 0.15);
    border: 2px solid #27ae60;
    text-align: center;
  }

  .recommended-header h2 {
    color: #34495e;
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .recommended-header p {
    color: #7f8c8d;
    font-size: 1rem;
    margin: 0 0 2rem 0;
  }

  .recommended-button {
    display: inline-flex;
    align-items: center;
    gap: 1.5rem;
    background: linear-gradient(135deg, #27ae60, #2ecc71);
    color: white;
    padding: 1.5rem 2rem;
    border-radius: 16px;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(39, 174, 96, 0.3);
    min-width: 350px;
  }

  .recommended-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(39, 174, 96, 0.4);
    background: linear-gradient(135deg, #219a52, #27ae60);
  }

  .recommended-icon {
    font-size: 2rem;
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
  }

  .recommended-info {
    flex: 1;
    text-align: left;
  }

  .recommended-title {
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .recommended-details {
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .recommended-arrow {
    transition: transform 0.2s ease;
  }

  .recommended-button:hover .recommended-arrow {
    transform: translateX(4px);
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
    }

    .title {
      font-size: 2rem;
    }

    .releases-grid {
      grid-template-columns: 1fr;
    }

    .release-card {
      padding: 1.5rem;
    }
  }
</style>

