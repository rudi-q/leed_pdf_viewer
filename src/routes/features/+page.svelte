<script lang="ts">
	import SEOHead from '$lib/components/SEOHead.svelte';

	const seoData = {
    title: 'LeedPDF Features - PDF Annotation Tools & Capabilities',
    description: 'Discover all LeedPDF features: draw, annotate, highlight, add text, shapes, and notes to PDFs. Works on any device with mouse, touch, or stylus input.',
    keywords: 'PDF features, PDF annotation tools, draw on PDF, PDF markup tools, PDF editor features, digital annotation',
    url: 'https://leed.my/features'
  };

  const features = [
    {
      icon: '🎨',
      title: 'Drawing & Annotation',
      description: 'Freehand drawing with customizable pencil and highlighter tools',
      details: [
        'Pressure-sensitive drawing with Apple Pencil support',
        'Multiple brush sizes and colors',
        'Smooth drawing experience on all devices',
        'Undo/redo functionality'
      ]
    },
    {
      icon: '📝',
      title: 'Text Annotations',
      description: 'Add text notes and comments directly to your PDFs',
      details: [
        'Click anywhere to add text',
        'Customizable fonts and sizes',
        'Multiple colors available',
        'Inline text editing'
      ]
    },
    {
      icon: '🔶',
      title: 'Shape Tools',
      description: 'Professional shapes including rectangles, circles, arrows, and stars',
      details: [
        'Perfect geometric shapes',
        'Customizable colors and styles',
        'Resize and move shapes easily',
        'Professional presentation quality'
      ]
    },
    {
      icon: '📌',
      title: 'Sticky Notes',
      description: 'Quick comments and reminders with colorful sticky notes',
      details: [
        'Multiple color options',
        'Expandable note areas',
        'Easy to position and resize',
        'Perfect for collaboration feedback'
      ]
    },
    {
      icon: '🧹',
      title: 'Smart Eraser',
      description: 'Intelligent eraser that removes intersecting elements precisely',
      details: [
        'Removes only what you touch',
        'Preserves underlying content',
        'Multiple eraser sizes',
        'Precision erasing capability'
      ]
    },
    {
      icon: '📱',
      title: 'Universal Device Support',
      description: 'Works perfectly on desktop, tablet, and mobile devices',
      details: [
        'Responsive design for all screen sizes',
        'Touch-optimized interface',
        'Keyboard shortcuts for power users',
        'Progressive Web App (PWA) support'
      ]
    },
    {
      icon: '🔒',
      title: 'Privacy First',
      description: '100% client-side processing - your files never leave your device',
      details: [
        'No file uploads required',
        'Local processing only',
        'No tracking or analytics',
        'GDPR compliant by design'
      ]
    },
    {
      icon: '⚡',
      title: 'High Performance',
      description: 'Instant loading and smooth performance on all devices',
      details: [
        'Instant PDF loading from URLs',
        'High-DPI rendering support',
        'Infinite canvas with pan and zoom',
        'Optimized for large documents'
      ]
    }
  ];
</script>

<SEOHead customSEO={seoData} />

<main class="min-h-screen bg-gradient-to-br from-cream via-sage/10 to-cream">
  <!-- Hero Section -->
  <section class="pt-20 pb-16 px-6">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-5xl font-bold text-charcoal mb-6">
        Powerful PDF Annotation Features
      </h1>
      <p class="text-xl text-slate mb-8 max-w-2xl mx-auto">
        Everything you need to annotate, markup, and collaborate on PDFs. 
        Professional tools that work seamlessly across all your devices.
      </p>
      <a 
        href="/" 
        class="primary-button text-lg px-8 py-4 inline-block"
      >
        Try LeedPDF Now
      </a>
    </div>
  </section>

  <!-- Features Grid -->
  <section class="py-16 px-6">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-charcoal text-center mb-12">
        Complete Annotation Toolkit
      </h2>
      
      <div class="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
        {#each features as feature}
          <div class="bg-white rounded-xl p-6 shadow-sm border border-sage/20 hover:shadow-md transition-shadow">
            <div class="flex items-start gap-4">
              <div class="text-4xl">{feature.icon}</div>
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-charcoal mb-2">
                  {feature.title}
                </h3>
                <p class="text-slate mb-4">
                  {feature.description}
                </p>
                <ul class="space-y-2">
                  {#each feature.details as detail}
                    <li class="flex items-start gap-2 text-sm text-slate">
                      <span class="text-sage mt-1">✓</span>
                      <span>{detail}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-16 px-6 bg-sage/5">
    <div class="max-w-4xl mx-auto text-center">
      <h2 class="text-3xl font-bold text-charcoal mb-4">
        Ready to Transform Your PDF Workflow?
      </h2>
      <p class="text-lg text-slate mb-8">
        Start annotating your PDFs with professional tools in seconds. No downloads, no accounts required.
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/" class="primary-button text-lg px-8 py-4">
          Get Started Free
        </a>
        <a href="/use-cases" class="secondary-button text-lg px-8 py-4">
          View Use Cases
        </a>
      </div>
    </div>
  </section>
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
    font-family: 'Inter', system-ui, sans-serif;
  }
</style>
