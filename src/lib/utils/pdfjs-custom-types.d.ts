import * as pdfjsLib from 'pdfjs-dist';

declare module 'pdfjs-dist' {
  export namespace GlobalWorkerOptions {
    let isEvalSupported: boolean;
  }
}