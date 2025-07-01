# 🎨 Leed

*An open-source, lovable PDF viewer with infinite drawing possibilities*

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/LeedPDF)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Leed** is a premium PDF viewer and annotation tool that transforms your PDFs into an infinite canvas for creativity. Draw, sketch, and annotate with the smoothness of pencil on paper, now in your browser.

## ✨ Features

### 🎯 **Core Functionality**
- 📄 **High-Quality PDF Rendering** - Crisp display on all screen types including retina displays
- ✏️ **Natural Drawing Experience** - Smooth pencil and eraser tools with pressure sensitivity
- 🎨 **Rich Color Palette** - Beautiful, curated color selection with modern UI
- 📐 **Precision Controls** - Adjustable line width and eraser sizes
- 🔄 **Complete Undo/Redo** - Full action history with keyboard shortcuts

### 🚀 **Advanced Features**
- 🌌 **Infinite Canvas** - Pan and zoom without limits, your drawings stay anchored
- 🎯 **Smart Cursor System** - Context-aware cursors that change based on your actions
- 📱 **Universal Input Support** - Mouse, trackpad, touch, and Apple Pencil optimized
- 💾 **Per-Page Storage** - Your annotations are saved separately for each PDF page
- ⌨️ **Power User Shortcuts** - Lightning-fast keyboard controls
- 🎨 **Premium UI/UX** - Clean, modern interface with smooth animations

### 🎮 **Interaction Models**
- **Inside PDF viewport**: 
  - Normal drawing with tools
  - Hold `Ctrl` to pan (cursor becomes hand)
- **Outside PDF viewport**: 
  - Always in pan mode for infinite canvas feel
  - No Ctrl needed for panning
- **Zoom anywhere**: `Ctrl + scroll` for precise zoom control

## 🛠️ Tech Stack

- **Framework**: SvelteKit + TypeScript
- **PDF Engine**: PDF.js with high-DPI rendering
- **Styling**: TailwindCSS with custom design system
- **Icons**: Lucide Svelte (Feather icon family)
- **Typography**: Playfair Display for premium branding
- **Build**: Vite with optimized bundling
- **Deployment**: Vercel with adapter-vercel
- **Code Quality**: ESLint + Prettier with Svelte rules

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/LeedPDF.git
cd LeedPDF
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Start development server**:
```bash
pnpm dev
```

4. **Open in browser**: Navigate to `http://localhost:5173`

## 📖 Usage Guide

### Getting Started
1. **Upload a PDF** - Click the folder icon or drag & drop any PDF file
2. **Choose your tool** - Pencil for drawing, eraser for corrections
3. **Pick your style** - Select colors and adjust sizes to your liking
4. **Start creating** - Draw naturally with mouse, touch, or stylus

### Navigation & Controls

#### **Mouse & Keyboard**
- **Navigate Pages**: `←/→` arrow keys or toolbar buttons
- **Zoom**: `Ctrl + scroll` or `Ctrl + +/-` keys
- **Pan**: `Ctrl + drag` inside PDF, or just drag outside PDF area
- **Reset View**: `Ctrl + 0` to center and reset zoom

#### **Drawing Tools**
- **Pencil**: Press `1` or click pencil icon
- **Eraser**: Press `2` or click eraser icon
- **Undo**: `Ctrl + Z`
- **Redo**: `Ctrl + Y` or `Ctrl + Shift + Z`
- **Clear Page**: Use the trash icon (with confirmation)

#### **Touch & Stylus**
- **Single finger**: Draw with selected tool
- **Two fingers**: Pan and zoom gestures
- **Apple Pencil**: Optimized pressure and tilt support

## 🏗️ Architecture

### Core Components

```
src/
├── lib/
│   ├── components/
│   │   ├── PDFViewer.svelte    # Main PDF canvas with drawing overlay
│   │   └── Toolbar.svelte      # Tool selection and controls
│   ├── stores/
│   │   └── drawingStore.ts     # State management for drawings and PDF
│   └── utils/
│       ├── pdfUtils.ts         # PDF.js integration and rendering
│       └── drawingUtils.ts     # Drawing engine and coordinate mapping
└── routes/
    └── +page.svelte           # Main application page
```

### Key Systems

#### **Drawing Engine**
- Real-time coordinate mapping between screen and PDF space
- Smooth path interpolation for natural drawing feel
- Efficient rendering with canvas optimizations
- Precise eraser collision detection

#### **Infinite Canvas**
- Viewport-independent coordinate system
- Drawings remain anchored to PDF content during pan/zoom
- Smooth transform animations with hardware acceleration
- Memory-efficient rendering of large documents

#### **State Management**
- Reactive stores for tool state, PDF state, and drawing history
- Undo/redo system with action batching
- Per-page drawing storage with automatic cleanup
- Persistent state across page navigation

## 🎨 Design Philosophy

**Leed** embodies the philosophy that digital tools should feel as natural as their physical counterparts. Every interaction is crafted to feel intuitive:

- **Premium Typography**: Playfair Display for sophisticated branding
- **Contextual Cursors**: Visual feedback that guides user interaction
- **Smooth Animations**: Micro-interactions that feel responsive and alive
- **Infinite Possibilities**: No artificial limits on canvas size or zoom levels
- **Universal Access**: Works beautifully on any device, any input method

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Deploy automatically** - Vercel will detect SvelteKit and use the right settings
3. **Custom domain** - Add your own domain in Vercel dashboard

### Manual Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview

# Deploy build files from 'build' directory
```

## 🧪 Development

### Code Quality

```bash
# Lint code
pnpm lint

# Format code
pnpm format

# Type checking
pnpm check
```

### Adding Features

1. **Drawing Tools**: Extend `DrawingEngine` class in `drawingUtils.ts`
2. **UI Components**: Add to `lib/components/` with proper TypeScript types
3. **State Management**: Extend stores in `drawingStore.ts`
4. **PDF Features**: Enhance `PDFManager` in `pdfUtils.ts`

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with proper commit messages
4. **Add tests** if applicable
5. **Submit a pull request**

### Contribution Guidelines
- Follow the existing code style (ESLint + Prettier)
- Write descriptive commit messages
- Update documentation for new features
- Test on multiple devices/browsers

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- **PDF.js** - Mozilla's excellent PDF rendering engine
- **SvelteKit** - The magical framework that makes this possible
- **Lucide** - Beautiful, consistent icon system
- **Vercel** - Seamless deployment and hosting

---

<div align="center">

**Built with ❤️ by developers who believe in open source**

*Transform your PDFs. Unleash your creativity. Share your ideas.*

[🌟 Star this project](https://github.com/yourusername/LeedPDF) • [🐛 Report bugs](https://github.com/yourusername/LeedPDF/issues) • [💡 Request features](https://github.com/yourusername/LeedPDF/issues)

</div>
