declare global {
  interface Window {
    Dropbox: {
      choose: (options: any) => void;
      isBrowserSupported: () => boolean;
      createChooseButton: (options: any) => HTMLElement;
    };
  }
}

export {};
