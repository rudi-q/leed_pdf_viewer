# Changelog

All notable changes to LeedPDF will be documented in this file.

## [Unreleased]

### Added
- **Auto-save drawings to browser**: Drawings are now automatically saved to localStorage and persist between sessions. Each PDF has its own drawing storage based on filename and file size.
- **Fit to Width/Height buttons**: Added "Fit W" and "Fit H" buttons to toolbar for quick viewport fitting.
- **Auto-save indicator**: Visual "Saved ✓" indicator appears in toolbar when drawings are saved.

### Changed
- **Compact toolbar**: Significantly reduced toolbar height and button sizes for more space.
- **Updated footer**: Merged open-source info with attribution and added GitHub icon link.

### Technical
- PDF-specific drawing storage prevents mixing drawings between different documents
- Improved SSR compatibility for browser-only features
