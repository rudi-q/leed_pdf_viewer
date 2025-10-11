import 'pdfjs-dist';

declare module 'pdfjs-dist' {
  global {
    interface GlobalWorkerOptions {
      isEvalSupported: boolean;
    }
  }
}