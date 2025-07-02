# To-Do List for LeedPDF Enhancements

## **0. Page Thumbnails/Navigator**
- **Description**: Add a sidebar with mini-page previews for quick navigation.
- **Difficulty**: Medium
- **Priority**: High
- **Steps**:
  1. Design sidebar layout.
  2. Use PDF.js to render thumbnails.
  3. Implement navigation linking.

## **1. Export Annotated PDF**
- **Description**: Enable users to save their annotated documents as a new PDF.
- **Difficulty**: Medium
- **Priority**: High
- **Steps**:
  1. Capture annotation data.
  2. Merge annotations into PDF using PDF.js.
  3. Provide download link.

## **2. Keyboard Shortcuts Overlay (Help)** ✅ COMPLETED
- **Description**: Provide an overlay with keyboard shortcuts.
- **Difficulty**: Low
- **Priority**: High
- **Implementation**:
  - ✅ Beautiful modal component with organized categories
  - ✅ Comprehensive shortcuts documentation
  - ✅ Multiple triggers: `?`, `F1`, and help button
  - ✅ Responsive design with backdrop blur
  - ✅ ESC to close, click outside to close

## **3. Recent Files List**
- **Description**: Show recently opened files on start screen.
- **Difficulty**: Low
- **Priority**: High
- **Steps**:
  1. Store recent files in localStorage.
  2. Update welcome screen to show list.

## **4. Auto-save Drawings to Browser** ✅ COMPLETED
- **Description**: Keep drawings in localStorage to prevent data loss.
- **Difficulty**: Low
- **Priority**: High
- **Implementation**:
  - ✅ PDF-specific storage using fileName + fileSize as unique key
  - ✅ Auto-save drawings to localStorage on every change
  - ✅ Auto-restore drawings when reopening same PDF
  - ✅ Visual "Saved ✓" indicator in toolbar
  - ✅ Clear drawings function for new PDFs

## **5. Fit to Width/Height Buttons** ✅ COMPLETED
- **Description**: Allow users to fit PDF to viewport width/height.
- **Difficulty**: Very Low
- **Priority**: High
- **Implementation**:
  - ✅ Added "Fit W" and "Fit H" buttons to toolbar
  - ✅ Implemented fitToWidth() and fitToHeight() methods
  - ✅ Auto-calculates optimal scale for viewport
  - ✅ Centers view and resets pan position

## **6. Dark Mode Toggle**
- **Description**: Provide a toggle to switch the app to dark mode.
- **Difficulty**: Low
- **Priority**: Medium

## **7. Touch/Mobile Optimization**
- **Description**: Improve usability on mobile/tablets.
- **Difficulty**: Low-Medium
- **Priority**: Medium

## **8. Drawing Smoothing/Pressure**
- **Description**: Implement smoother lines and pressure sensitivity.
- **Difficulty**: Low
- **Priority**: Medium

## **9. Fullscreen Mode** ✅ COMPLETED
- **Description**: Allow users to hide UI and enter fullscreen.
- **Difficulty**: Low
- **Priority**: Medium
- **Implementation**:
  - ✅ F11 key toggles fullscreen mode
  - ✅ ESC key exits fullscreen
  - ✅ Cross-browser fullscreen API support
  - ✅ Automatic state tracking
  - ✅ Distraction-free PDF viewing experience

## **10. Text Highlighting Tool**
- **Description**: Add a tool to highlight text in documents.
- **Difficulty**: Medium-High
- **Priority**: Low

## **11. Search in PDF**
- **Description**: Allow users to search text within PDFs.
- **Difficulty**: Medium-High
- **Priority**: Low
