import '@testing-library/jest-dom';
import { afterEach, beforeAll, vi } from 'vitest';

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
		this.size = bits.reduce(
			(acc, bit) =>
				acc + (typeof bit === 'string' ? bit.length : (bit as ArrayBuffer).byteLength || 0),
			0
		);
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
		getPage: vi.fn((pageNum) =>
			Promise.resolve({
				getViewport: vi.fn(() => ({ width: 612, height: 792 })),
				render: vi.fn(() => ({ promise: Promise.resolve() }))
			})
		),
		getMetadata: vi.fn(() =>
			Promise.resolve({
				info: { Title: 'Test PDF' }
			})
		),
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
