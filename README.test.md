# LeedPDF Test Suite

This document describes the comprehensive test suite for the LeedPDF application, covering all major functionalities.

## Test Structure

The test suite is organized into several categories:

### 1. Unit Tests (`src/**/*.test.ts`)
- **PDF Utilities Tests** (`src/lib/utils/pdfUtils.test.ts`)
- **Drawing Store Tests** (`src/lib/stores/drawingStore.test.ts`)
- **Konva Shape Engine Tests** (`src/lib/utils/konvaShapeEngine.test.ts`)
- **Drawing Utils Tests** (`src/lib/utils/drawingUtils.test.ts`)

### 2. End-to-End Tests (`tests/e2e/`)
- **Application Tests** (`tests/e2e/app.spec.ts`)
- **PDF Loading Tests**
- **Drawing Features Tests**
- **Export/Save Tests**
- **Accessibility Tests**

## Prerequisites

Before running tests, ensure you have installed all dependencies:

```bash
pnpm install
```

## Running Tests

### Unit Tests

Run all unit tests:
```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test:watch
```

Run tests with coverage:
```bash
pnpm test:coverage
```

Run tests with UI:
```bash
pnpm test:ui
```

### End-to-End Tests

Build the application first:
```bash
pnpm build
```

Run E2E tests:
```bash
pnpm test:e2e
```

Run E2E tests in headed mode:
```bash
pnpm test:e2e --headed
```

Run E2E tests in debug mode:
```bash
pnpm test:e2e --debug
```

## Test Coverage

The test suite aims for the following coverage targets:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Current Coverage Areas

#### PDF Utilities (`pdfUtils.test.ts`)
- ✅ PDF loading from files and URLs
- ✅ PDF rendering and page management
- ✅ CORS proxy fallbacks for URL loading
- ✅ Dropbox URL conversion
- ✅ Error handling for invalid PDFs
- ✅ Page dimensions calculation
- ✅ Resource cleanup and memory management

#### Drawing Store (`drawingStore.test.ts`)
- ✅ State management for drawing tools
- ✅ Drawing path storage and retrieval
- ✅ Shape object management
- ✅ Undo/redo functionality
- ✅ LocalStorage persistence
- ✅ PDF-specific drawing storage
- ✅ Auto-save functionality
- ✅ Constants and configuration arrays

#### Konva Shape Engine (`konvaShapeEngine.test.ts`)
- ✅ Engine initialization and setup
- ✅ Tool switching and cursor management
- ✅ Text and sticky note creation
- ✅ Shape serialization and deserialization
- ✅ Canvas operations (resize, clear, export)
- ✅ Event callback system
- ✅ Multiple shape type support
- ✅ Error handling and memory management

#### Drawing Utils (`drawingUtils.test.ts`)
- ✅ Drawing engine initialization
- ✅ Drawing operations (start, continue, end)
- ✅ Multiple tool support (pencil, eraser, highlight)
- ✅ Path rendering and scaling
- ✅ Point operations and coordinate conversion
- ✅ Path intersection detection
- ✅ Path simplification algorithms
- ✅ Bounding box calculations

#### End-to-End Tests (`app.spec.ts`)
- ✅ Application loading and welcome screen
- ✅ Navigation and routing
- ✅ PDF file upload and loading
- ✅ Drawing tools and annotations
- ✅ Export and save functionality
- ✅ Keyboard navigation and accessibility
- ✅ Mobile responsiveness
- ✅ Error handling

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)
- Uses jsdom environment for DOM testing
- Includes comprehensive mocking setup
- Coverage reporting with thresholds
- Test file pattern matching

### Playwright Configuration (`playwright.config.ts`)
- Multi-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile device testing
- Screenshot and video capture on failure
- Automatic dev server startup

## Mocking Strategy

The test suite uses extensive mocking to isolate functionality:

### Global Mocks (`src/test/setup.ts`)
- **Tauri APIs**: `invoke`, `message`, `readFile`
- **PDF.js**: PDF loading and rendering
- **Konva**: Canvas drawing and shape management
- **Canvas Context**: 2D drawing operations
- **File API**: File upload and handling
- **LocalStorage**: Data persistence
- **IntersectionObserver**: Lazy loading

### Test Helpers
- Mock PDF document creation
- Mock file creation utilities
- LocalStorage mock implementation

## Running Specific Test Suites

### Run PDF utilities tests only:
```bash
pnpm test src/lib/utils/pdfUtils.test.ts
```

### Run drawing store tests only:
```bash
pnpm test src/lib/stores/drawingStore.test.ts
```

### Run Konva engine tests only:
```bash
pnpm test src/lib/utils/konvaShapeEngine.test.ts
```

### Run drawing utils tests only:
```bash
pnpm test src/lib/utils/drawingUtils.test.ts
```

### Run E2E tests for specific functionality:
```bash
pnpm test:e2e --grep "PDF Loading"
pnpm test:e2e --grep "Drawing Features"
pnpm test:e2e --grep "Accessibility"
```

## Debugging Tests

### Unit Tests
```bash
# Run with verbose output
pnpm test --reporter=verbose

# Run specific test with debugging
pnpm test --reporter=verbose --grep "specific test name"

# Open test UI for interactive debugging
pnpm test:ui
```

### E2E Tests
```bash
# Run with browser UI visible
pnpm test:e2e --headed

# Run in debug mode with browser dev tools
pnpm test:e2e --debug

# Run specific test file
pnpm test:e2e tests/e2e/app.spec.ts
```

## Continuous Integration

The test suite is designed to run in CI environments:

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: pnpm
      - run: pnpm install
      - run: pnpm test:coverage
      - run: pnpm build
      - run: pnpm test:e2e
```

## Test Data

### Sample PDF Files
- Minimal PDF for basic loading tests
- Multi-page PDF for navigation tests
- PDF with metadata for title extraction tests

### Mock Drawing Data
- Sample drawing paths with different tools
- Shape objects with various types
- Intersection test cases for eraser functionality

## Best Practices

1. **Isolation**: Each test is independent and can run alone
2. **Mocking**: External dependencies are mocked consistently
3. **Cleanup**: Tests clean up after themselves
4. **Assertions**: Clear, meaningful assertions
5. **Coverage**: Aim for high coverage with meaningful tests
6. **Performance**: Tests run quickly and efficiently
7. **Maintenance**: Tests are easy to update when code changes

## Troubleshooting

### Common Issues

**Tests failing in CI but passing locally:**
- Check for timing issues in async operations
- Ensure all dependencies are properly mocked
- Verify browser compatibility for E2E tests

**Canvas-related test failures:**
- Ensure proper canvas context mocking
- Check for DOM element availability
- Verify drawing operation sequences

**PDF loading test failures:**
- Check PDF.js mock implementation
- Verify file reading mock setup
- Ensure proper error handling tests

**E2E test timeouts:**
- Increase timeout values for slow operations
- Check for proper element waiting strategies
- Verify application build and server startup

## Contributing to Tests

When adding new features:

1. **Write unit tests** for new utilities and functions
2. **Update existing tests** if behavior changes
3. **Add E2E tests** for new user-facing features
4. **Maintain coverage** targets
5. **Update documentation** for new test patterns

### Test File Naming Convention
- Unit tests: `*.test.ts` alongside source files
- E2E tests: `*.spec.ts` in `tests/e2e/` directory
- Test utilities: `src/test/` directory

### Mock File Organization
- Global mocks: `src/test/setup.ts`
- Specific mocks: Alongside test files
- Test helpers: `src/test/helpers/`
