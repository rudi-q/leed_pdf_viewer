# Changelog

All notable changes to LeedPDF will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Auto-fit to height when PDF first loads for better initial viewing experience
- Console logs disabled in production builds for cleaner performance

## [v1.4.0] - 2025-01-02

### Added
- **Progressive Web App (PWA) Support**
  - App is now installable on mobile and desktop devices
  - Offline functionality after first visit
  - Service worker with Workbox caching for faster loading
  - Auto-updating mechanism for new versions
  - Standalone display mode for native app feel
  - File handling capability for PDF files

### Added
- **'U' Keyboard Shortcut for File Upload**
  - Quick file upload with U key
  - Updated keyboard shortcuts help documentation
  - Works alongside existing toolbar upload button

### Fixed
- Lazy loading issues in page thumbnails
- WebSocket HMR (Hot Module Reload) connection problems
- Development server stability improvements

## [v1.3.0] - 2025-01-01

### Added
- **Page Thumbnails Navigator**
  - Sidebar panel with 120x160px page previews
  - Click-to-navigate functionality between pages
  - Toggle button in toolbar with Layout icon
  - T key keyboard shortcut for quick toggle
  - Visual indicator for currently active page
  - Lazy loading for better performance
  - Responsive layout integration

### Fixed
- Drawing alignment issues in PDF export
- Canvas coordinate system synchronization
- Export quality improvements

## [v1.2.0] - 2024-12-31

### Added
- **Custom Cursor System**
  - Custom SVG pencil cursor with proper hotspot (2,18)
  - Custom SVG eraser cursor with visual feedback (10,10)
  - Fallback cursor support for compatibility
  - Dynamic cursor switching based on active tool
  - Stored in /static/cursors/ for better organization

### Fixed
- Cursor deployment issues in production
- SVG cursor accessibility and loading

## [v1.1.0] - 2024-12-30

### Added
- **PDF Export with Annotations**
  - Export annotated PDFs with all drawings and shapes
  - Canvas merging system (PDF + drawings + shapes)
  - High-resolution export with device pixel ratio support
  - Automatic filename generation with _annotated.pdf suffix
  - One-click export from toolbar
  - Full preservation of original PDF quality

### Added
- **Comprehensive Keyboard Shortcuts**
  - Tool shortcuts: 1-6 keys for switching tools
  - Navigation: Arrow keys for pages, W/H for fit-to-width/height
  - Zoom: Ctrl+/-, Ctrl+0, Ctrl+scroll wheel
  - Actions: Ctrl+Z/Y for undo/redo, U for upload
  - Utility: F11 for fullscreen, ? for help, T for thumbnails
  - Updated help overlay with all shortcuts

### Improved
- Text tool now starts with empty text input
- Empty text automatically removed on ESC key
- Better text editing workflow

## [v1.0.0] - 2024-12-29

### Added
- **Hybrid Drawing System**
  - Canvas-based freehand drawing (pencil, eraser)
  - Overlay-based shape tools (rectangle, circle, arrow, text)
  - Full undo/redo system for all tools
  - Tool-specific event handling and optimization

### Added
- **Keyboard Shortcuts Overlay**
  - Comprehensive help modal with organized categories
  - Multiple triggers: ?, F1, and help button
  - Responsive design with backdrop blur
  - ESC to close, click outside to close

### Added
- **Fullscreen Mode**
  - F11 key toggles fullscreen mode
  - ESC key exits fullscreen
  - Cross-browser fullscreen API support
  - Automatic state tracking
  - Distraction-free PDF viewing experience

### Improved
- Eraser tool now properly erases all types of shapes
- Enhanced shape intersection detection for arrows
- Better persistence of annotations in localStorage

## [v0.9.0] - 2024-12-28

### Added
- **Auto-save Drawing System**
  - PDF-specific storage using fileName + fileSize as unique key
  - Auto-save drawings to localStorage on every change
  - Auto-restore drawings when reopening same PDF
  - Visual "Saved ✓" indicator in toolbar
  - Clear drawings function for new PDFs

### Added
- **Fit to Width/Height Controls**
  - "Fit W" and "Fit H" buttons in toolbar
  - Auto-calculates optimal scale for viewport
  - Centers view and resets pan position
  - Better initial PDF viewing experience

### Changed
- **Compact toolbar**: Significantly reduced toolbar height and button sizes for more space
- **Updated footer**: Merged open-source info with attribution and added GitHub icon link

### Technical
- Improved Canvas and drawing system integration
- Better event handling for different drawing tools
- Enhanced coordinate system synchronization
- PDF-specific drawing storage prevents mixing drawings between different documents
- Improved SSR compatibility for browser-only features
