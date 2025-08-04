# LeedPDF ✏️
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**A modern, open-source PDF annotation tool that runs entirely in your browser**

Transform any PDF into an interactive canvas. Draw, annotate, and collaborate without uploading your documents to external servers.

[**Try it now →**](https://leed.my) | [**Report Issues**](https://github.com/rudi-q/leed_pdf_viewer/issues) | [**Contribute**](https://github.com/rudi-q/leed_pdf_viewer/blob/main/CONTRIBUTING.md)

## ✨ Features

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
Share annotated PDFs by adding `?pdf=` to any URL:
```
https://leed.my?pdf=https://example.com/document.pdf
```

### Option 3: Run Locally
```bash
git clone https://github.com/rudi-q/leed_pdf_viewer.git
cd leed_pdf_viewer
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

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
- **Draw**: Select pencil tool and start drawing
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
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
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

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PDF.js** - Mozilla's excellent PDF rendering engine
- **SvelteKit** - The framework that makes this possible
- **Konva.js** - Powerful 2D canvas library
- **Tailwind CSS** - Utility-first CSS framework

---

**Built with ❤️ for the open web**

*Privacy-focused • Lightweight • No tracking • No accounts • No servers*