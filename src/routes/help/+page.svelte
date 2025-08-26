<script lang="ts">
	import SEOHead from '$lib/components/SEOHead.svelte';

	const seoData = {
    title: 'LeedPDF Help & Documentation - Complete User Guide',
    description: 'Complete help documentation for LeedPDF. Learn how to annotate PDFs, use drawing tools, keyboard shortcuts, and advanced features.',
    keywords: 'LeedPDF help, PDF annotation guide, drawing tools tutorial, keyboard shortcuts, PDF editor documentation',
    url: 'https://leed.my/help'
  };

  const helpSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      items: [
        {
          question: 'How do I start using LeedPDF?',
          answer: 'Simply visit leed.my and either upload a PDF file or paste a PDF URL. No registration or download required!'
        },
        {
          question: 'What file formats are supported?',
          answer: 'LeedPDF supports standard PDF files up to 50MB. You can upload local files or load PDFs from URLs (including Dropbox links).'
        },
        {
          question: 'Do I need to create an account?',
          answer: 'No! LeedPDF works without any account registration. Just open the app and start annotating immediately.'
        },
        {
          question: 'Is my data safe?',
          answer: 'Absolutely. All processing happens locally in your browser. Your PDFs never leave your device or get uploaded to our servers.'
        }
      ]
    },
    {
      id: 'tools',
      title: 'Drawing Tools',
      icon: '🎨',
      items: [
        {
          question: 'How do I select different tools?',
          answer: 'Use the toolbar at the top or keyboard shortcuts: 1 (Pencil), 2 (Eraser), 3 (Text), 4 (Rectangle), 5 (Circle), 6 (Arrow), 7 (Star), 8 (Highlight), 9 (Notes).'
        },
        {
          question: 'Can I change colors and sizes?',
          answer: 'Yes! Click on the color palette and size options in the toolbar. Each tool remembers your preferred settings.'
        },
        {
          question: 'How does the smart eraser work?',
          answer: 'The smart eraser removes only the drawing elements you touch, preserving the original PDF content underneath.'
        },
        {
          question: 'Can I add text annotations?',
          answer: 'Select the text tool (T) or press 3, then click anywhere on the PDF to add text. You can edit text by double-clicking it.'
        }
      ]
    },
    {
      id: 'navigation',
      title: 'Navigation & Viewing',
      icon: '🧭',
      items: [
        {
          question: 'How do I navigate between pages?',
          answer: 'Use arrow keys (← →), the page navigation buttons in the toolbar, or click the thumbnail panel (T key).'
        },
        {
          question: 'How do I zoom in and out?',
          answer: 'Use Ctrl + scroll wheel, Ctrl +/- keys, or the zoom buttons in the toolbar. Ctrl+0 resets zoom to fit.'
        },
        {
          question: 'Can I fit the PDF to my screen?',
          answer: 'Yes! Press W to fit width or H to fit height. The toolbar also has fit-to-width and fit-to-height buttons.'
        },
        {
          question: 'How do I pan around the document?',
          answer: 'Hold Ctrl and drag to pan, or simply drag in empty areas outside the PDF content.'
        }
      ]
    },
    {
      id: 'shortcuts',
      title: 'Keyboard Shortcuts',
      icon: '⌨️',
      items: [
        {
          question: 'What are the essential keyboard shortcuts?',
          answer: 'Numbers 1-9 select tools, Arrow keys navigate pages, Ctrl+Z/Y for undo/redo, W/H for fit width/height, T for thumbnails, U to upload, F for focus mode.'
        },
        {
          question: 'How do I undo and redo changes?',
          answer: 'Press Ctrl+Z to undo and Ctrl+Y or Ctrl+Shift+Z to redo. These work for all drawing and annotation actions.'
        },
        {
          question: 'Is there a fullscreen mode?',
          answer: 'Yes! Press F11 to enter fullscreen mode. Press Escape or F11 again to exit.'
        },
        {
          question: 'How do I access help quickly?',
          answer: 'Press ? (question mark) or F1 to open the keyboard shortcuts panel from anywhere in the app.'
        }
      ]
    },
    {
      id: 'advanced',
      title: 'Advanced Features',
      icon: '⚡',
      items: [
        {
          question: 'How do I export my annotated PDF?',
          answer: 'Click the export button in the toolbar or use the file menu. Your annotations will be embedded in the exported PDF.'
        },
        {
          question: 'Can I load PDFs from cloud storage?',
          answer: 'Yes! You can paste direct links to PDFs from Dropbox, Google Drive, or any publicly accessible URL.'
        },
        {
          question: 'Does LeedPDF work on tablets?',
          answer: 'Absolutely! LeedPDF is optimized for touch devices and works great with styluses like Apple Pencil.'
        },
        {
          question: 'Can I work offline?',
          answer: 'Yes! LeedPDF is a PWA (Progressive Web App) that works offline after your first visit. You can annotate local PDFs without internet.'
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🛠️',
      items: [
        {
          question: 'My PDF won\'t load. What should I do?',
          answer: 'Check that the file is a valid PDF under 50MB. For URL loading, ensure the link is publicly accessible and ends with .pdf.'
        },
        {
          question: 'The drawing feels laggy. How can I improve performance?',
          answer: 'Try reducing the zoom level, closing other browser tabs, or switching to a simpler drawing tool. Performance improves on modern devices.'
        },
        {
          question: 'My annotations disappeared. Can I recover them?',
          answer: 'LeedPDF auto-saves your work locally. Try refreshing the page or uploading the same file again to restore your annotations.'
        },
        {
          question: 'Can I use LeedPDF on my phone?',
          answer: 'Yes! LeedPDF works on mobile browsers. For the best experience on small screens, use landscape orientation and focus mode (F key).'
        }
      ]
    },
    {
      id: 'feedback',
      title: 'Feedback & Support',
      icon: '💬',
      items: [
        {
          question: 'How do I report a bug?',
          answer: 'Found a bug? Please report it on our <a href="https://github.com/rudi-q/leed_pdf_viewer/issues" target="_blank" rel="noopener" class="text-sage hover:text-sage/80 underline">GitHub Issues page</a>. Include details about what you were doing when the bug occurred and your browser/device information.'
        },
        {
          question: 'How can I request a new feature?',
          answer: 'Have an idea for a new feature? We\'d love to hear it! Submit your feature request on <a href="https://github.com/rudi-q/leed_pdf_viewer/issues" target="_blank" rel="noopener" class="text-sage hover:text-sage/80 underline">GitHub Issues</a>. Describe your use case and how the feature would help you.'
        },
        {
          question: 'Is there a community or forum?',
          answer: 'The best place to discuss LeedPDF, ask questions, and connect with other users is through <a href="https://github.com/rudi-q/leed_pdf_viewer" target="_blank" rel="noopener" class="text-sage hover:text-sage/80 underline">GitHub Discussions and Issues</a>.'
        },
        {
          question: 'How can I contribute to the project?',
          answer: 'LeedPDF is open source! You can contribute code, report bugs, suggest features, or help with documentation. Check out our Contributing Guide on GitHub for more information.'
        }
      ]
    }
  ];

  let activeSection = 'getting-started';
  
  function setActiveSection(sectionId: string) {
    activeSection = sectionId;
  }
</script>

<SEOHead customSEO={seoData} />

<main class="min-h-screen bg-gradient-to-br from-cream via-sage/10 to-cream">
  <!-- Hero Section -->
  <section class="pt-20 pb-16 px-6">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-5xl font-bold text-charcoal mb-6">
        Help & Documentation
      </h1>
      <p class="text-xl text-slate mb-8 max-w-2xl mx-auto">
        Everything you need to master PDF annotation with LeedPDF. 
        From basic tools to advanced features.
      </p>
    </div>
  </section>

  <!-- Help Content -->
  <section class="py-16 px-6">
    <div class="max-w-6xl mx-auto">
      <div class="grid lg:grid-cols-4 gap-8">
        <!-- Navigation Sidebar -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-xl p-6 shadow-sm border border-sage/20 sticky top-8">
            <h2 class="text-lg font-semibold text-charcoal mb-4">Quick Navigation</h2>
            <nav class="space-y-2">
              {#each helpSections as section}
                <button
                  class={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                    activeSection === section.id 
                      ? 'bg-sage/10 text-sage font-medium' 
                      : 'text-slate hover:bg-sage/5 hover:text-charcoal'
                  }`}
                  on:click={() => setActiveSection(section.id)}
                >
                  <span class="text-lg">{section.icon}</span>
                  <span>{section.title}</span>
                </button>
              {/each}
            </nav>
          </div>
        </div>

        <!-- Main Content -->
        <div class="lg:col-span-3">
          {#each helpSections as section}
            <div 
              id={section.id}
              class={`${activeSection === section.id ? 'block' : 'hidden'}`}
            >
              <div class="bg-white rounded-xl p-8 shadow-sm border border-sage/20">
                <div class="flex items-center gap-4 mb-8">
                  <span class="text-4xl">{section.icon}</span>
                  <h2 class="text-3xl font-bold text-charcoal">{section.title}</h2>
                </div>

                <div class="space-y-6">
                  {#each section.items as item}
                    <div class="border-b border-sage/10 last:border-b-0 pb-6 last:pb-0">
                      <h3 class="text-lg font-semibold text-charcoal mb-3">
                        {item.question}
                      </h3>
                      <p class="text-slate leading-relaxed">
                        {@html item.answer}
                      </p>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- Quick Start CTA -->
  <section class="py-16 px-6 bg-sage/5">
    <div class="max-w-4xl mx-auto text-center">
      <h2 class="text-3xl font-bold text-charcoal mb-4">
        Ready to Get Started?
      </h2>
      <p class="text-lg text-slate mb-8">
        The best way to learn is by doing. Start annotating your first PDF now!
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/" class="primary-button text-lg px-8 py-4">
          Start Annotating
        </a>
        <a href="https://github.com/rudi-q/leed_pdf_viewer/issues" target="_blank" rel="noopener" class="secondary-button text-lg px-8 py-4">
          Report Issue
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
