# Contributing to LeedPDF

Thanks for your interest in contributing! LeedPDF is built to be a privacy-first, client-side PDF annotation tool, and we welcome contributions that align with this vision.

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** 
- **pnpm** (recommended) or npm
- Basic knowledge of **SvelteKit** and **TypeScript**

### Setup
```bash
# Clone the repo
git clone https://github.com/rudi-q/leed_pdf_viewer.git
cd leed_pdf_viewer

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:5173
```

## 📁 Project Structure

```
src/
├── lib/
│   ├── components/          # Svelte components
│   │   ├── PDFViewer.svelte # Main PDF rendering & drawing
│   │   ├── Toolbar.svelte   # Tool selection & controls
│   │   └── ...
│   ├── stores/              # Svelte stores for state management
│   │   └── drawingStore.ts  # Drawing tools, PDF state, auto-save
│   └── utils/               # Core utilities
│       ├── pdfUtils.ts      # PDF.js integration
│       └── drawingUtils.ts  # Canvas drawing engine
├── routes/                  # SvelteKit routes
└── static/                  # Static assets (cursors, icons)
```

## 🛠️ Development Guidelines

### Code Style
We use **ESLint** and **Prettier** with strict TypeScript. Run these before committing:

```bash
# Check and fix linting issues
pnpm lint
pnpm lint:fix

# Format code
pnpm format

# Type checking
pnpm check
```

### Key Principles
- **Privacy first** - everything runs client-side, no data leaves the user's device
- **Performance** - smooth drawing experience, efficient rendering
- **Accessibility** - keyboard shortcuts, screen reader friendly
- **Cross-platform** - works on desktop, tablet, and mobile

### Architecture Notes

#### Drawing System
- **Freehand tools** (pencil, eraser, highlighter) use HTML5 Canvas via `DrawingEngine`
- **Annotation tools** (text, sticky notes, stamps, arrows) use custom SVG-based overlay components
- **Coordinate system** uses relative positioning (0-1 range) for zoom-independent drawing

#### State Management
- **Svelte stores** handle all state (drawing tools, PDF state, undo/redo)
- **Auto-save** to localStorage with PDF-specific keys (filename + filesize)
- **Per-page storage** - drawings are isolated by page number

#### PDF Handling
- **PDF.js** for rendering with high-DPI support
- **URL loading** supports direct links, Dropbox shares, etc.
- **Export** merges original PDF with annotations using pdf-lib

## 🐛 Reporting Issues

### Bug Reports
Include:
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Browser/device** information
- **PDF file details** (if relevant) - size, source, etc.
- **Console errors** (if any)

### Feature Requests
Describe:
- **What problem** this solves
- **How it fits** with LeedPDF's privacy-first approach
- **Alternative solutions** you've considered

## 🔄 Pull Request Process

### Before You Start
1. **Check existing issues** - maybe someone's already working on it
2. **Open an issue** for major changes to discuss the approach
3. **Fork the repo** and create a feature branch

### Making Changes
```bash
# Create a feature branch
git checkout -b feature/amazing-new-tool

# Make your changes
# ... code, code, code ...

# Test your changes
pnpm dev  # Manual testing
pnpm check  # Type checking
pnpm lint  # Code style

# Commit with clear messages
git commit -m "Add highlight tool with opacity control

- Implement highlighter drawing mode
- Add opacity slider to toolbar
- Store highlight paths separately from pencil paths
- Update keyboard shortcuts (8 key)"
```

### PR Requirements
- ✅ **Passes all checks** (lint, type checking)
- ✅ **Tested on multiple browsers** (Chrome, Firefox, Safari)
- ✅ **Mobile-friendly** if UI changes
- ✅ **Maintains privacy** - no external API calls for core functionality
- ✅ **Clear commit messages** explaining what and why
- ✅ **Updated documentation** if needed

### PR Description Template
```markdown
## What does this PR do?
Brief description of the changes.

## How to test
1. Step one
2. Step two
3. Expected result

## Screenshots/Video
(If UI changes)

## Checklist
- [ ] Tested on desktop and mobile
- [ ] No console errors
- [ ] Follows existing code style
- [ ] Documentation updated (if needed)
```

## 🎯 Good First Issues

New to the project? Look for issues labeled:
- `good first issue` - well-defined, smaller scope
- `help wanted` - we'd love community input
- `enhancement` - new features that don't require deep architectural knowledge

### Easy Wins
- **New drawing tools** (highlighter colors, line styles)
- **Keyboard shortcuts** improvements
- **UI polish** (animations, visual feedback)
- **Mobile experience** enhancements
- **Accessibility** improvements

## 🧪 Testing

Currently manual testing, but we're planning:
- **Unit tests** for utility functions
- **Integration tests** for drawing engines
- **E2E tests** for core user flows

Help us add testing infrastructure if that's your thing!

## 📝 Documentation

- **Code comments** for complex logic, especially coordinate transformations
- **JSDoc** for public APIs
- **README updates** for new features
- **Inline help** in the UI where helpful

## 🤝 Community

- **Be respectful** - we're all here to build something cool
- **Ask questions** - better to clarify than assume
- **Share ideas** - even "crazy" ones sometimes lead to breakthroughs
- **Help others** - review PRs, answer questions in issues

## 🚫 What We Don't Want

- **Server-side dependencies** for core functionality
- **User tracking** or analytics
- **Heavy dependencies** that bloat the bundle
- **Breaking changes** without strong justification
- **Features** that compromise privacy or simplicity

---

**Questions?** Open an issue or reach out to [@rudi-q](https://github.com/rudi-q).

Thanks for helping make LeedPDF better! 🎨