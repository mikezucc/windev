declare module 'webm-writer' {
  export default class WebMWriter {
    constructor(options?: {
      quality?: number;
      frameRate?: number;
      transparent?: boolean;
    });

    addFrame(canvas: HTMLCanvasElement | string, duration: number): void;
    complete(): Promise<Blob>;
  }
}
