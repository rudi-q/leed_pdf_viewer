<script lang="ts">
	import SEOHead from '$lib/components/SEOHead.svelte';

	const seoData = {
    title: 'LeedPDF Use Cases - Perfect for Students, Professionals & Researchers',
    description: 'Discover how students, professionals, researchers, and teams use LeedPDF for PDF annotation, review, collaboration, and digital note-taking.',
    keywords: 'PDF use cases, student PDF tools, professional PDF annotation, research PDF markup, team collaboration, digital note-taking',
    url: 'https://leed.my/use-cases'
  };

  const useCases = [
    {
      icon: '🎓',
      title: 'Students',
      subtitle: 'Study Smarter, Not Harder',
      description: 'Transform your study materials with interactive annotations and visual note-taking.',
      scenarios: [
        {
          situation: 'Lecture Slides & Textbooks',
          solution: 'Highlight key concepts, add personal notes, and draw diagrams directly on PDFs'
        },
        {
          situation: 'Research Papers',
          solution: 'Annotate sources, mark important quotes, and create visual connections between ideas'
        },
        {
          situation: 'Assignment Feedback',
          solution: 'Review instructor comments and add your own study notes for future reference'
        },
        {
          situation: 'Group Study Sessions',
          solution: 'Share annotated PDFs with classmates and collaborate on study materials'
        }
      ],
      benefits: ['Better retention through visual learning', 'Organized digital notes', 'Easy sharing with study groups', 'Works on tablets with stylus'],
      testimonial: 'LeedPDF has revolutionized how I study. I can annotate my lecture slides on my iPad with Apple Pencil and access them anywhere.',
      testimonialAuthor: 'Sarah M., University Student'
    },
    {
      icon: '💼',
      title: 'Professionals',
      subtitle: 'Streamline Your Document Workflow',
      description: 'Enhance productivity with professional PDF markup tools for contracts, reports, and presentations.',
      scenarios: [
        {
          situation: 'Contract Reviews',
          solution: 'Mark clauses, add comments, and highlight important terms before negotiations'
        },
        {
          situation: 'Report Annotations',
          solution: 'Add feedback, corrections, and suggestions to team reports and proposals'
        },
        {
          situation: 'Client Presentations',
          solution: 'Mark up presentation drafts with real-time feedback during client meetings'
        },
        {
          situation: 'Compliance Documents',
          solution: 'Annotate regulatory documents and create audit trails for compliance reviews'
        }
      ],
      benefits: ['Professional markup tools', 'No data privacy concerns', 'Cross-device synchronization', 'Export annotated PDFs'],
      testimonial: 'As a lawyer, I need to annotate contracts daily. LeedPDF gives me the tools I need without compromising client confidentiality.',
      testimonialAuthor: 'James L., Corporate Attorney'
    },
    {
      icon: '🔬',
      title: 'Researchers',
      subtitle: 'Accelerate Your Research Process',
      description: 'Organize research papers, annotate findings, and create visual research maps.',
      scenarios: [
        {
          situation: 'Literature Reviews',
          solution: 'Color-code different themes, highlight methodology, and add research notes'
        },
        {
          situation: 'Data Analysis',
          solution: 'Annotate charts and graphs, mark significant findings, and add interpretation notes'
        },
        {
          situation: 'Peer Review',
          solution: 'Provide detailed feedback on manuscripts with precise annotations and comments'
        },
        {
          situation: 'Grant Proposals',
          solution: 'Review and annotate funding proposals with team members and advisors'
        }
      ],
      benefits: ['Systematic research organization', 'Visual pattern recognition', 'Collaborative review process', 'Citation management support'],
      testimonial: 'LeedPDF helps me organize my research papers visually. I can see patterns and connections that I missed before.',
      testimonialAuthor: 'Dr. Maria R., Research Scientist'
    },
    {
      icon: '👥',
      title: 'Teams',
      subtitle: 'Collaborate Without Compromise',
      description: 'Enable seamless team collaboration on documents while maintaining version control.',
      scenarios: [
        {
          situation: 'Design Reviews',
          solution: 'Mark up design mockups and prototypes with detailed feedback and suggestions'
        },
        {
          situation: 'Project Planning',
          solution: 'Annotate project documents, timelines, and specifications collaboratively'
        },
        {
          situation: 'Quality Assurance',
          solution: 'Review documentation, mark issues, and track resolution progress'
        },
        {
          situation: 'Training Materials',
          solution: 'Create interactive training documents with annotations and explanations'
        }
      ],
      benefits: ['Real-time collaboration', 'Version control friendly', 'No account requirements', 'Universal device support'],
      testimonial: 'Our design team uses LeedPDF for all our mockup reviews. Everyone can contribute feedback without technical barriers.',
      testimonialAuthor: 'Alex K., Design Team Lead'
    }
  ];
</script>

<SEOHead customSEO={seoData} />

<main class="min-h-screen bg-gradient-to-br from-cream via-sage/10 to-cream">
  <!-- Hero Section -->
  <section class="pt-20 pb-16 px-6">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-5xl font-bold text-charcoal mb-6">
        Perfect for Every Use Case
      </h1>
      <p class="text-xl text-slate mb-8 max-w-2xl mx-auto">
        Whether you're a student, professional, researcher, or team member, 
        LeedPDF adapts to your unique PDF annotation needs.
      </p>
    </div>
  </section>

  <!-- Use Cases -->
  <section class="py-16 px-6">
    <div class="max-w-6xl mx-auto space-y-20">
      {#each useCases as useCase, index}
        <div class="grid lg:grid-cols-2 gap-12 items-start">
          <!-- Content -->
          <div class={`${index % 2 === 1 ? 'lg:order-2' : ''}`}>
            <div class="flex items-center gap-4 mb-6">
              <div class="text-5xl">{useCase.icon}</div>
              <div>
                <h2 class="text-3xl font-bold text-charcoal">{useCase.title}</h2>
                <p class="text-lg text-sage font-medium">{useCase.subtitle}</p>
              </div>
            </div>
            
            <p class="text-lg text-slate mb-8">{useCase.description}</p>
            
            <!-- Scenarios -->
            <h3 class="text-xl font-semibold text-charcoal mb-4">Common Scenarios</h3>
            <div class="space-y-4 mb-8">
              {#each useCase.scenarios as scenario}
                <div class="bg-white rounded-lg p-4 border border-sage/20">
                  <h4 class="font-semibold text-charcoal mb-2">{scenario.situation}</h4>
                  <p class="text-slate">{scenario.solution}</p>
                </div>
              {/each}
            </div>
            
            <!-- Benefits -->
            <h3 class="text-xl font-semibold text-charcoal mb-4">Key Benefits</h3>
            <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
              {#each useCase.benefits as benefit}
                <li class="flex items-start gap-2 text-slate">
                  <span class="text-sage mt-1">✓</span>
                  <span>{benefit}</span>
                </li>
              {/each}
            </ul>
          </div>
          
          <!-- Testimonial -->
          <div class={`${index % 2 === 1 ? 'lg:order-1' : ''}`}>
            <div class="bg-white rounded-xl p-8 shadow-sm border border-sage/20">
              <div class="text-sage mb-4 text-2xl">"</div>
              <blockquote class="text-lg text-charcoal mb-6 leading-relaxed">
                {useCase.testimonial}
              </blockquote>
              <cite class="text-slate font-medium">— {useCase.testimonialAuthor}</cite>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-16 px-6 bg-sage/5">
    <div class="max-w-4xl mx-auto text-center">
      <h2 class="text-3xl font-bold text-charcoal mb-4">
        Find Your Perfect PDF Workflow
      </h2>
      <p class="text-lg text-slate mb-8">
        Join thousands of users who have transformed their PDF experience with LeedPDF.
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/" class="primary-button text-lg px-8 py-4">
          Start Annotating Now
        </a>
        <a href="/features" class="secondary-button text-lg px-8 py-4">
          Explore Features
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
