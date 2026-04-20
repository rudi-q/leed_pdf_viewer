# Changelog

All notable changes to LeedPDF will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v2.31.0] - 2026-03-27

### Added
- Native vector annotation rendering in PDF export — annotations (paths, text, arrows, stamps, sticky notes) are now embedded as vectors instead of being rasterized to canvas, producing cleaner and smaller output files
- Full rotation-aware coordinate transformations for all annotation types during export
- Shape-to-path conversion for SVG circles and ellipses for consistent vector rendering
- Scale-aware line width adjustments during annotation storage and rendering
- Crop box handling for accurate base coordinate mapping in rotated and cropped PDF pages

### Fixed
- Fallback PDF export now creates blank pages for missing canvases instead of failing
- Improved LPDF import robustness with drawing tool type and page number validation
- HTTP response validation when fetching fonts with detailed error messages
- Opacity fallback changed from `||` to `??` to correctly handle `0` opacity values

### Changed
- Updated CI workflows to use Node.js 24 and pnpm 10.32.1
- Centralized annotation CRUD logic into reusable generic utilities (DRY refactor)

---

## [v2.30.0] - 2026-03-10

### Added
- PDF page rotation with `R` (rotate right) and `Shift+R` (rotate left) keyboard shortcuts
- All annotation types (text, arrows, stamps, sticky notes) reposition and export correctly at any rotation angle
- `rotationUtils` module for point transformations between rotated and unrotated coordinate spaces
- View Options dropdown in the toolbar (Reset Zoom, Fit Width, Fit Height)
- Undo state support when clearing drawing paths
- Keyboard interaction for text annotations: edit with `Enter`/`Space`, delete with `Delete`/`Backspace`
- `clearCurrentPageDrawings` now clears all annotation types for the current page

### Fixed
- Lazy loading in PageThumbnails now initialises only when the panel is visible
- Zoom level resets to 100% instead of 120% on document open

---

## [v2.29.0] - 2026-02-25

### Added
- Smooth two-finger panning for touchscreen users

### Fixed
- Resolved longstanding pinch-zoom bugs (issue #138)

---

## [v2.28.0] - 2026-02-24

### Added
- Export any single PDF page as a PNG, or all pages as a ZIP of PNGs
- Convert images (JPG, PNG, WebP) directly into a PDF document
- Touchscreen gesture hints via new `GestureHint` component and `gestureUtils` module
- New convert routes: `/convert/jpg-to-pdf`, `/convert/png-to-pdf`, `/convert/webp-to-pdf`, `/convert/markdown-to-pdf`
- `DropzonePage` component for drag-and-drop image import

---

## [v2.27.0] - 2026-02-22

### Added
- Enhanced scaling behaviour in presentation mode for better full-screen rendering quality
- Refined compressed export functionality with additional quality controls

---

## [v2.26.0] - 2026-02-18

### Added
- Export PDFs with high compression — reduces file size up to 80% without major loss in visual quality

---

## [v2.25.0] - 2026-02-15

### Added
- Smart scrolling for smoother document navigation
- Support for clicking internal and external PDF links seamlessly
- Improved overall accessibility for screen readers and keyboard users

---

## [v2.24.0] - 2026-02-10

### Added
- `Ctrl/Cmd + S` keyboard shortcut for quickly saving and exporting documents
- Window title now dynamically updates to reflect the current document name

---

## [v2.23.0] - 2026-02-05

### Added
- Presentation mode for distraction-free fullscreen PDF viewing
- All UI toolbars and panels are automatically hidden in presentation mode

---

## [v2.22.0] - 2026-01-30

### Added
- Desktop app can now detect and use fonts installed natively on the OS
- Wider variety of typography options for text annotations on desktop

---

## [v2.21.0] - 2026-01-25

### Added
- Dropdown font picker for the text annotation tool
- Scroll, preview, and select fonts when adding inline text to PDFs

---

## [v2.20.0] - 2026-01-20

### Added
- New PDF templates: `storyboard_2x3` and `handwriting`

---

## [v2.19.4] - 2026-01-15

### Fixed
- Native file export for merged PDFs on desktop

---

## [v2.19.3] - 2026-01-12

### Changed
- Security dependency bumps (14 packages) via Dependabot

---

## [v2.19.2] - 2026-01-10

### Fixed
- LPDF export failure for encrypted PDFs

---

## [v2.19.1] - 2025-10-23

### Added
- `7` key shortcut for the select-text tool
- `Alt+Erase` gesture documented in keyboard shortcuts help

### Changed
- Extracted keyboard shortcuts to a shared utility (DRY refactor)
- Added SSR guards and proper type checks to keyboard helpers

### Fixed
- Prevent default browser scrolling on arrow key navigation
- Detect `contenteditable` elements correctly in keyboard utility

---

## [v2.19.0] - 2025-10-20

### Added
- Modify PDFs: merge multiple PDFs and reorder pages

---

## [v2.18.0] - 2025-10-14

### Added
- `Alt+Erase` for partial stroke removal — erases only the portion of a stroke under the eraser path
- `splitPathByEraser()` utility for vector stroke splitting with configurable tolerance

### Fixed
- Robust eraser hit-testing using CSS px coordinates and normalised relative points
- Undo now works correctly after erasing strokes

---

## [v2.17.0] - 2025-10-11

### Added
- Text Selection Overlay

---

## [v2.16.0] - 2025-10-11

### Added
- Highlighter color picker

### Improved
- Performance optimizations for highlighting

---

## [v2.15.0] - 2025-10-09

### Improved
- UX with fallback button for external PDF links
- Better toolbar icons

---

## [v2.14.2] - 2025-10-04

### Added
- PPP (Purchasing Power Parity) pricing banner
- Homepage improvements

---

## [v2.14.1] - 2025-10-04

### Added
- Updated toolbar icons

---

## [v2.14.0] - 2025-10-03

### Added
- Resize and delete on hover/double-click for the text annotation tool

---

## [v2.13.0] - 2025-10-03

### Added
- External link opening with deep links for the desktop app

---

## [v2.12.3] - 2025-10-02

### Added
- Sharing enabled for the desktop app

---

## [v2.12.2] - 2025-09-30

### Fixed
- Updated e2e tests

---

## [v2.12.1] - 2025-09-24

### Added
- Tooltips for better accessibility and improved UX

---

## [v2.12.0] - 2025-09-24

### Added
- Tooltips across the toolbar for better accessibility

---

## [v2.11.0] - 2025-09-22

### Added
- Export as DOCX

---

## [v2.10.0] - 2025-09-21

### Added
- View-only shareable links

---

## [v2.9.1] - 2025-09-19

### Fixed
- PDF sharing bug fixes

---

## [v2.9.0] - 2025-09-17

### Added
- Share PDFs via link

---

## [v2.8.0] - 2025-09-17

### Added
- LPDF file format support for importing/exporting PDFs with annotations

---

## [v2.7.0] - 2025-09-16

### Added
- GDPR compliance and cookie consent banner

---

## [v2.4.0] - 2025-09-01

### Added
- New PDF templates: `CollegeRuled2` and `Cornell`
- `HelpButton` and `HomeButton` extracted as dedicated components
- Toolbar improvements and UX polish across all routes

---

## [v2.3.0] - 2025-08-26

### Changed
- Dependency bumps (15 packages)

---

## [v2.2.0] - 2025-08-21

### Added
- Desktop app: license manager with EULA enforcement via Tauri
- Native file export routes for macOS and Windows (`/download-for-mac`, `/download-for-windows`)
- `LicenseModal` component and `licenseManager` utility
- `tauriUtils` for Tauri-specific helpers
- Desktop EULA (`LICENSE-DESKTOP-EULA`)

---

## [v2.1.0] - 2025-08-19

### Improved
- Sticky note and text annotation appearance
- Custom font support for annotations

---

## [v2.0.1] - 2025-08-19

### Fixed
- Export canvas race conditions causing misaligned annotations on export
- Overlay position glitches resolved by awaiting canvas resize before state changes
- Exported canvases now accurately match on-screen PDF rendering

---

## [v2.0.0] - 2025-08-18

### Added
- Full rewrite as a SvelteKit + Tauri app
- Desktop app support (Windows, macOS)
- Stamps, arrows, sticky notes, and text annotation tools
- Multi-page PDF support with page thumbnails
- LPDF format groundwork

---

## [v1.5.0] - 2025-08-13

### Fixed
- CORS: updated `+server.ts` to allow requests from the main domain

---

## [v1.4.0] - 2025-01-02

### Added
- Progressive Web App (PWA) support — installable on mobile and desktop
- Offline functionality after first visit via Workbox service worker
- Auto-updating mechanism for new versions
- File handling capability for PDF files
- `U` keyboard shortcut for quick file upload

### Fixed
- Lazy loading issues in page thumbnails
- WebSocket HMR connection problems in development

---

## [v1.3.0] - 2025-01-01

### Added
- Page Thumbnails navigator sidebar with click-to-navigate and `T` keyboard shortcut
- Lazy loading for thumbnails

### Fixed
- Drawing alignment issues in PDF export
- Canvas coordinate system synchronization

---

## [v1.2.0] - 2024-12-31

### Added
- Custom SVG pencil and eraser cursors with proper hotspots
- Dynamic cursor switching based on active tool

### Fixed
- Cursor deployment issues in production

---

## [v1.1.0] - 2024-12-30

### Added
- PDF export with all drawings and annotations merged
- High-resolution export with device pixel ratio support
- Comprehensive keyboard shortcuts (tools, navigation, zoom, undo/redo, fullscreen)

### Improved
- Text tool starts with empty input; empty text auto-removed on `Esc`

---

## [v1.0.0] - 2024-12-29

### Added
- Hybrid drawing system: canvas-based freehand (pencil, eraser) + overlay-based shapes (rectangle, circle, arrow, text)
- Full undo/redo for all tools
- Keyboard shortcuts overlay (`?`, `F1`)
- Fullscreen mode (`F11`)

### Improved
- Eraser now correctly erases all shape types
- Annotations persisted to localStorage

---

## [v0.9.0] - 2024-12-28

### Added
- Auto-save drawings to localStorage per PDF (keyed by filename + file size)
- Auto-restore drawings when reopening the same PDF
- Fit to Width / Fit to Height toolbar controls
- Compact toolbar redesign

---

## [v0.1.0] - 2025-08-04

### Added
- Initial web prototype of LeedPDF
