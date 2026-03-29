# Changelog

All notable changes to LeedPDF will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

- Auto-fit to height when PDF first loads for better initial viewing experience
- Console logs disabled in production builds for cleaner performance

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
- `clearCurrentPageDrawings` now clears all annotation types (text, arrows, stamps, sticky notes) for the current page

### Fixed
- Lazy loading in PageThumbnails now initialises only when the panel is visible
- Zoom level resets to 100% instead of 120% on document open

---

## [v2.29.0] - 2026-02-25

### Added
- Smooth two-finger panning for touchscreen users navigating PDF documents

### Fixed
- Resolved longstanding pinch-zoom bugs (issue #138) for a more reliable touch experience

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

## [v2.19.2] - 2026-01-10

### Fixed
- LPDF export failure for encrypted PDFs

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
- PPP (Purchasing Power Parity) banner
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

## [v1.0.0] - 2025-08-21

### Added
- Initial release of LeedPDF Web App
- Highlights, comments, and doodle annotation features
- Windows download page with system requirements
- Open-source page with AGPL license details
