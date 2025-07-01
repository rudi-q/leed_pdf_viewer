# LeedPDF ✏️

A vibey, intuitive PDF viewer and drawing app built with SvelteKit. Draw, sketch, and annotate PDFs with the smoothness of pencil on paper.

## ✨ Features

- **Smooth Drawing**: Apple Pencil, stylus, mouse, or touch support with pressure sensitivity
- **PDF Rendering**: High-quality PDF viewing with zoom and navigation
- **Drawing Tools**: 
  - ✏️ Pencil with customizable colors and line thickness
  - 🧽 Eraser for removing drawings
  - 🎨 Color palette with vibey, creative colors
  - 📏 Variable line thickness (1-12px)
- **Vibey UI**: Clean, minimal design with smooth animations and glass-morphism effects
- **Cross-Device**: Works on desktop, tablet, and mobile
- **Keyboard Shortcuts**: Navigate and control tools with hotkeys
- **Page Management**: Navigate through multi-page PDFs
- **Undo/Redo**: Non-destructive editing with undo functionality

## 🚀 Tech Stack

- **Framework**: SvelteKit for reactive, lightweight performance
- **PDF**: PDF.js for client-side PDF rendering  
- **Drawing**: HTML5 Canvas with optimized drawing engine
- **Styling**: Tailwind CSS with custom creative color palette
- **State**: Svelte stores for reactive drawing and PDF state
- **Export**: PDF-lib for saving annotated PDFs

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/leedpdf.git
cd leedpdf

# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build
```

## 🎮 Usage

### Getting Started
1. **Upload PDF**: Click the 📁 upload button or drag & drop a PDF file
2. **Select Tool**: Choose ✏️ pencil or 🧽 eraser from the toolbar
3. **Pick Color**: Click the color swatch to open the palette
4. **Adjust Size**: Click the line thickness indicator to change brush size
5. **Start Drawing**: Click and drag on the PDF to draw smoothly

### Controls

#### Toolbar
- 📁 **Upload**: Load PDF files
- ⬅️➡️ **Navigation**: Previous/Next page  
- 🔍-/🔍+ **Zoom**: Zoom in/out
- ✏️ **Pencil**: Freehand drawing tool
- 🧽 **Eraser**: Remove drawings
- 🎨 **Color Picker**: Choose from vibey color palette
- 📏 **Line Thickness**: Adjust brush size (1-12px)
- ↶ **Undo**: Remove last drawing stroke
- 🗑️ **Clear**: Clear all drawings on current page

#### Keyboard Shortcuts
- `←/→` - Navigate pages
- `Ctrl/Cmd + +/-` - Zoom in/out
- `Ctrl/Cmd + 0` - Reset zoom
- `Ctrl/Cmd + Z` - Undo (coming soon)

### Drawing Tips
- **Smooth Lines**: The app uses quadratic curves for naturally smooth strokes
- **Pressure Sensitivity**: Works with Apple Pencil and pressure-sensitive styluses
- **Performance**: Optimized for real-time drawing with no lag
- **Multi-Page**: Drawings are saved per page - switch pages to see different annotations

## 🎨 Color Palette

The app features a carefully curated, vibey color palette:
- **Charcoal** (#2D3748) - Default drawing color
- **Sage** (#87A96B) - Accent and UI color
- **Lavender** (#C4A5E7) - Creative purple
- **Peach** (#FFB5A7) - Warm accent
- **Mint** (#A8E6CF) - Fresh green
- Plus additional vibrant colors for creative expression

## 🏗️ Architecture

### Components
- `PDFViewer.svelte` - Main PDF rendering and drawing surface
- `Toolbar.svelte` - Tool selection and controls
- `drawingStore.ts` - State management for drawing tools and PDF state
- `pdfUtils.ts` - PDF loading and rendering utilities
- `drawingUtils.ts` - Canvas drawing engine with smooth line algorithms

### Key Features
- **Reactive State**: Svelte stores sync drawing state across components
- **Smooth Drawing**: Advanced drawing engine with curve smoothing
- **Performance**: Optimized canvas operations and event handling
- **Responsive**: Works across devices with touch/pointer events
- **Accessible**: Keyboard navigation and screen reader support

## 💫 Made with 💚

LeedPDF is crafted with love for digital creators, students, professionals, and anyone who loves the satisfying feeling of drawing on PDFs. Keep it vibey! ✨

---

*Built with SvelteKit, PDF.js, and a lot of ☕*
