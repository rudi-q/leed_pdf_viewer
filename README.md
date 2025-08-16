<div align="center">
  <img src="static/logo.png" alt="LeedPDF Logo" width="160" height="160">
  
  # LeedPDF - Free PDF Annotation Tool
  
  **Add drawings and notes to any PDF.**
  
  *Works with mouse, touch, or stylus - completely free and private.*
</div>
<br>

<div align="center">

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-87A96B.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Commercial License](https://img.shields.io/badge/Commercial%20License-Available-87A96B.svg)](https://buy.polar.sh/polar_cl_tPmQ3d72uYwrYvzzIUM4R7cku7hg2kmEQqruI1its5c)
[![Free for Personal Use](https://img.shields.io/badge/Free-Personal%20Use-87A96B.svg)](#-agpl-30-free--open-source)
[![GitHub Stars](https://img.shields.io/github/stars/rudi-q/leed_pdf_viewer?color=87A96B&style=flat&logo=github)](https://github.com/rudi-q/leed_pdf_viewer/stargazers)
[![Downloads](https://img.shields.io/github/downloads/rudi-q/leed_pdf_viewer/total?label=Downloads&logo=github&color=87A96B)](https://github.com/rudi-q/leed_pdf_viewer/releases)
[![WCAG AAA Compliant](https://img.shields.io/badge/WCAG%20AAA-Compliant-87A96B?style=flat&logo=accessibilityalt&logoColor=white)](https://www.w3.org/WAI/WCAG2AAA-Conformance)
[![Accessibility Score](https://img.shields.io/badge/Accessibility-7.06:1%20Contrast-87A96B?style=flat&logo=eyeopen&logoColor=white)](#%EF%B8%8F-accessibility-first)

[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PDF.js](https://img.shields.io/badge/PDF.js-000000?style=flat&logo=mozilla&logoColor=white)](https://mozilla.github.io/pdf.js/)
[![Konva.js](https://img.shields.io/badge/Konva.js-00D1B2?style=flat&logo=konva&logoColor=white)](https://konvajs.org/)
[![Brave Search API](https://img.shields.io/badge/Brave%20Search-FF6B35?style=flat&logo=brave&logoColor=white)](https://api.search.brave.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tauri](https://img.shields.io/badge/Tauri-FFC131?style=flat&logo=tauri&logoColor=black)](https://tauri.app/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![CodeRabbit](https://img.shields.io/badge/CodeRabbit-AI%20Reviews-FF6B9D?style=flat&logo=rabbitmq&logoColor=white)](https://coderabbit.ai/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

**A modern, open-source PDF annotation tool that runs entirely in your browser**

Transform any PDF into an interactive canvas. Draw, annotate, and collaborate without uploading your documents to external servers.

<div align="center">
  <img src="static/screenshot.png" alt="LeedPDF in action - annotating a Y Combinator fundraising guide with highlights, comments, and drawings" width="800" style="border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);">
</div>

[**Try it now →**](https://leed.my) | [**Report Issues**](https://github.com/rudi-q/leed_pdf_viewer/issues) | [**Contribute**](https://github.com/rudi-q/leed_pdf_viewer/blob/main/CONTRIBUTING.md)

## ✨ Features

### 🔍 **PDF Search & Discovery**
- **Web-wide PDF search** powered by Brave Search API
- **Direct PDF opening** from search results
- **Smart filtering** for PDF documents only
- **Pagination** through search results
- **Real-time search** with instant results
- **Setup guide**: See [docs/SEARCH_FEATURE.md](docs/SEARCH_FEATURE.md) for configuration

### 🎨 **Drawing & Annotation**
- **Freehand drawing** with customizable pencil and highlighter tools
- **Shape tools** including rectangles, circles, arrows, and stars
- **Text annotations** with inline editing
- **Sticky notes** for quick comments
- **Smart eraser** that removes intersecting elements

### 📱 **Universal Access**
- Works on **any device** - desktop, tablet, or phone
- **Touch-optimized** with Apple Pencil support
- **No installation required** - runs in your browser
- **Offline capable** after first visit (PWA)

### ♿ **Accessibility First**
- **WCAG AAA compliant** - exceeds accessibility standards with 7.06:1 contrast ratios
- **Keyboard navigation** - full functionality without a mouse
- **Screen reader friendly** - semantic HTML and proper ARIA labels
- **High contrast mode** support for visually impaired users
- **Scalable interface** - works with browser zoom up to 200%
- **Color blind friendly** - doesn't rely solely on color for information
- **Focus indicators** - clear visual focus states for all interactive elements

### 🔒 **Privacy First**
- **100% client-side** - your PDFs never leave your device
- **No account required** - start annotating immediately
- **Local auto-save** - your work is preserved automatically

### ⚡ **Performance**
- **Instant loading** from URLs (including Dropbox links)
- **High-DPI rendering** for crisp display on all screens
- **Infinite canvas** - pan and zoom without limits
- **Full undo/redo** with keyboard shortcuts

## 🚀 Quick Start

### Option 1: Use Online
Visit [leed.my](https://leed.my) and start annotating immediately.

### Option 2: Load from URL
Share annotated PDFs by adding `/pdf/` to any URL:
```
https://leed.my/pdf/https://example.com/document.pdf
```

### Option 3: Run Locally
```bash
git clone https://github.com/rudi-q/leed_pdf_viewer.git
cd leed_pdf_viewer
pnpm install
pnpm build && pnpm preview
```

Open `http://localhost:4173` in your browser.

## 🛠️ Tech Stack

- **Framework**: SvelteKit + TypeScript
- **PDF Rendering**: PDF.js
- **Drawing Engine**: HTML5 Canvas + Konva.js
- **Styling**: Tailwind CSS
- **Build**: Vite
- **PWA**: @vite-pwa/sveltekit

## 📖 Usage

### Basic Controls
- **Upload**: Drag & drop a PDF or click the folder icon
- **Draw**: Select the pencil tool and start drawing
- **Navigate**: Use arrow keys or toolbar buttons
- **Zoom**: Ctrl + scroll wheel or toolbar buttons
- **Pan**: Ctrl + drag (or just drag outside PDF area)

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Tools | `1-9` (pencil, eraser, text, etc.) |
| Navigation | `←/→` for pages, `W/H` for fit |
| Zoom | `Ctrl +/-`, `Ctrl 0` to reset |
| Actions | `Ctrl Z/Y` for undo/redo |
| Upload | `U` to choose file |
| Help | `?` or `F1` |

## 🎯 Perfect For

- **Students** reviewing lecture slides and textbooks
- **Professionals** annotating contracts and reports
- **Researchers** marking up papers and documentation
- **Teams** collaborating on design mockups
- **Anyone** who needs to mark up PDFs quickly

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm/pnpm/yarn

### Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Project Structure
```
src/
├── lib/
│   ├── components/     # Svelte components
│   ├── stores/         # State management
│   └── utils/          # PDF and drawing utilities
├── routes/             # SvelteKit routes
└── app.html           # App template
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/awesome-feature`
3. **Commit** your changes: `git commit -m 'Add awesome feature'`
4. **Push** to the branch: `git push origin feature/awesome-feature`
5. **Open** a Pull Request

### Development Guidelines
- Follow the existing code style (ESLint + Prettier configured)
- Test your changes across different devices/browsers
- Update documentation for new features
- Keep commits atomic and well-described

## 💬 Community & Feedback

We'd love to hear from you! Join our community discussions:

- **💚 [Wall of Love](https://github.com/rudi-q/leed_pdf_viewer/discussions/categories/wall-of-love)** - Share your feedback about what you loved about LeedPDF and why
- **🙏 [Q&A](https://github.com/rudi-q/leed_pdf_viewer/discussions/categories/q-a)** - Ask any questions you may have
- **🗳️ [Polls](https://github.com/rudi-q/leed_pdf_viewer/discussions/categories/polls)** - Poll on ideas
- **💡 [Ideas](https://github.com/rudi-q/leed_pdf_viewer/discussions/categories/ideas)** - Share new ideas
- **🙌 [Show and Tell](https://github.com/rudi-q/leed_pdf_viewer/discussions/categories/show-and-tell)** - Show us how you're using LeedPDF

You can also use [GitHub Issues](https://github.com/rudi-q/leed_pdf_viewer/issues) for bug reports.

## 📄 License

LeedPDF is **dual-licensed** to give you flexibility:

### 🆓 **AGPL-3.0 (Free & Open Source)**
Perfect for:
- ✅ Personal projects and learning
- ✅ Educational and research use
- ✅ Non-commercial applications
- ✅ Internal company tools (no external service)
- ✅ Contributing back to the community

### 💼 **Commercial License (Paid)**
Required for:
- 🏢 Commercial products and services
- 🏢 Proprietary software integration
- 🏢 SaaS applications and hosted services
- 🏢 Client work and consulting projects
- 🏢 Removing AGPL-3.0 obligations

---

## 💳 **Commercial Licensing Options**

**[🛒 Get Commercial License](https://buy.polar.sh/polar_cl_tPmQ3d72uYwrYvzzIUM4R7cku7hg2kmEQqruI1its5c)**

Available options:
- **Individual License** - Solo developers and small companies
- **Team License** - Growing teams and agencies (up to 10 developers)
- **Enterprise License** - Large organizations with custom terms

*For Enterprise licensing and custom requirements, contact [reach@rudi.engineer](mailto:reach@rudi.engineer)*

### 🤝 **What You Get With Commercial License:**
- ✅ Remove AGPL-3.0 copyleft requirements
- ✅ Use in proprietary/commercial applications
- ✅ No source code disclosure obligations
- ✅ Distribute without open-sourcing your app
- ✅ Remove attribution requirements
- ✅ Email support for integration questions
- ✅ Perpetual license (no expiration)

### ❓ **Need Help Choosing?**
- **Personal project?** → Use AGPL-3.0 (free)
- **Building a commercial product?** → Individual License ($99)
- **Team of developers?** → Team License ($399)
- **Large company/custom terms?** → Enterprise License ($1,299+)

**Questions about licensing?** Contact us: [reach@rudi.engineer](mailto:reach@rudi.engineer)

---

*By using LeedPDF, you agree to comply with the terms of your chosen license. The AGPL-3.0 license requires that any network-accessible modifications be open-sourced.*

## 🙏 Acknowledgments

- **PDF.js** - Mozilla's excellent PDF rendering engine
- **SvelteKit** - The framework that makes this possible
- **Konva.js** - Powerful 2D canvas library
- **Brave Search API** - Powering our web-wide PDF search functionality
- **Vite** - Lightning-fast build tool
- **Tauri** - For building lightweight desktop apps
- **Tailwind CSS** - Utility-first CSS framework

---

**Built with ❤️ for the open web**

*Privacy-focused • Lightweight • No tracking • No accounts • No servers*
