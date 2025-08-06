import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';

// Mock import.meta.url for test environment
if (!import.meta.url) {
  Object.defineProperty(import.meta, 'url', {
    value: 'http://localhost:3000/test.js',
    writable: true
  });
}

// Mock browser environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000'
  }
});

// Mock fetch globally
globalThis.fetch = vi.fn();

// Mock URL constructor to handle import.meta.url properly
const OriginalURL = globalThis.URL;
globalThis.URL = class extends OriginalURL {
  constructor(url: string | URL, base?: string | URL) {
    // Handle the case where base is import.meta.url (which might be an object in tests)
    if (typeof base === 'object' && base !== null && !base.href) {
      base = 'http://localhost:3000';
    }
    super(url, base);
  }
  static createObjectURL = vi.fn(() => 'mock-object-url');
  static revokeObjectURL = vi.fn();
} as any;

// Mock Tauri APIs
const mockTauriApi = {
  invoke: vi.fn(),
  message: vi.fn(),
  readFile: vi.fn()
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockTauriApi.invoke
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  message: mockTauriApi.message
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: mockTauriApi.readFile
}));

// Mock PDF.js - prevent actual module loading
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 3,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn(() => ({ width: 612, height: 792 })),
        render: vi.fn(() => ({ promise: Promise.resolve() }))
      }),
      getMetadata: vi.fn().mockResolvedValue({
        info: { Title: 'Test PDF' }
      }),
      destroy: vi.fn()
    })
  }),
  GlobalWorkerOptions: {
    workerSrc: ''
  },
  version: '3.11.174'
}));

// Mock the worker file import
vi.mock('pdfjs-dist/build/pdf.worker.mjs', () => ({
  default: {}
}));

// Mock Konva with proper instances
const createMockKonvaNode = (type: string): any => {
  const node: any = {
    id: vi.fn((id?: string) => id ? node : `${type}_${Date.now()}`),
    x: vi.fn((x?: number) => x !== undefined ? node : 0),
    y: vi.fn((y?: number) => y !== undefined ? node : 0),
    width: vi.fn((w?: number) => w !== undefined ? node : 100),
    height: vi.fn((h?: number) => h !== undefined ? node : 100),
    text: vi.fn((t?: string) => t !== undefined ? node : 'test'),
    fontSize: vi.fn((s?: number) => s !== undefined ? node : 16),
    fill: vi.fn((f?: string) => f !== undefined ? node : '#000000'),
    stroke: vi.fn((s?: string) => s !== undefined ? node : '#000000'),
    strokeWidth: vi.fn((w?: number) => w !== undefined ? node : 2),
    radius: vi.fn((r?: number) => r !== undefined ? node : 50),
    points: vi.fn((p?: number[]) => p !== undefined ? node : [0, 0, 100, 100]),
    draggable: vi.fn((d?: boolean) => d !== undefined ? node : true),
    destroy: vi.fn(),
    getParent: vi.fn(() => null),
    getAbsolutePosition: vi.fn(() => ({ x: 0, y: 0 })),
    add: vi.fn(),
    type: type
  };
  return node;
};

vi.mock('konva', () => ({
  default: {
    Stage: vi.fn((config) => {
      const stage: any = {
        add: vi.fn(),
        width: vi.fn((w?: number) => w !== undefined ? stage : config?.width || 800),
        height: vi.fn((h?: number) => h !== undefined ? stage : config?.height || 600),
        getPointerPosition: vi.fn(() => ({ x: 0, y: 0 })),
        on: vi.fn(),
        container: vi.fn(() => ({
          style: {},
          getBoundingClientRect: vi.fn(() => ({
            top: 0,
            left: 0,
            width: 800,
            height: 600
          }))
        })),
        toCanvas: vi.fn(() => document.createElement('canvas')),
        destroy: vi.fn()
      };
      return stage;
    }),
    Layer: vi.fn(() => ({
      add: vi.fn(),
      find: vi.fn(() => []),
      destroy: vi.fn()
    })),
    Transformer: vi.fn(() => ({
      nodes: vi.fn(),
      destroy: vi.fn()
    })),
    Text: vi.fn((config) => createMockKonvaNode('text')),
    Rect: vi.fn((config) => createMockKonvaNode('rect')),
    Circle: vi.fn((config) => createMockKonvaNode('circle')),
    Arrow: vi.fn((config) => createMockKonvaNode('arrow')),
    Star: vi.fn((config) => createMockKonvaNode('star')),
    Group: vi.fn(() => {
      const group: any = createMockKonvaNode('group');
      group.textNode = null;
      group.backgroundNode = null;
      return group;
    })
  }
}));

// Mock canvas context
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  globalCompositeOperation: 'source-over',
  globalAlpha: 1,
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  imageSmoothingEnabled: true
})) as any;

// Mock canvas toDataURL
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');

// Mock File API
globalThis.File = class MockFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;

  constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
    this.name = name;
    this.size = bits.reduce((acc, bit) => acc + (typeof bit === 'string' ? bit.length : (bit as ArrayBuffer).byteLength || 0), 0);
    this.type = options?.type || '';
    this.lastModified = options?.lastModified || Date.now();
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size));
  }

  text(): Promise<string> {
    return Promise.resolve('');
  }
} as any;

// URL methods are already mocked in the URL class above

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock devicePixelRatio
Object.defineProperty(window, 'devicePixelRatio', { value: 1 });

// Mock IntersectionObserver
globalThis.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as any;

// Global test helpers
(globalThis as any).testHelpers = {
  mockTauriApi,
  localStorageMock,
  createMockPDF: (numPages: number = 3) => ({
    numPages,
    getPage: vi.fn((pageNum) => Promise.resolve({
      getViewport: vi.fn(() => ({ width: 612, height: 792 })),
      render: vi.fn(() => ({ promise: Promise.resolve() }))
    })),
    getMetadata: vi.fn(() => Promise.resolve({
      info: { Title: 'Test PDF' }
    })),
    destroy: vi.fn()
  }),
  createMockFile: (name: string = 'test.pdf', size: number = 1024) => 
    new File(['test content'], name, { type: 'application/pdf' })
};

beforeAll(() => {
  // Reset all mocks before each test
});

afterEach(() => {
  vi.clearAllMocks();
});
