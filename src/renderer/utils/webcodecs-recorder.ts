import WebMWriter from 'webm-writer';

export class WebCodecsRecorder {
  private encoder: VideoEncoder | null = null;
  private writer: any = null;
  private frameCount = 0;
  private startTime = 0;
  private width = 0;
  private height = 0;
  private videoChunks: Uint8Array[] = [];

  async startRecording(width: number, height: number): Promise<void> {
    this.frameCount = 0;
    this.startTime = performance.now();
    this.width = width;
    this.height = height;
    this.videoChunks = [];

    // Initialize WebM writer
    this.writer = new WebMWriter({
      quality: 0.85,
      frameRate: 10,
      transparent: false,
    });

    // Configure video encoder
    this.encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.videoChunks.push(data);
      },
      error: (error) => {
        console.error('VideoEncoder error:', error);
      },
    });

    await this.encoder.configure({
      codec: 'vp8',
      width,
      height,
      bitrate: 2_000_000, // 2 Mbps
      framerate: 10,
      latencyMode: 'realtime',
    });
  }

  async addFrame(imageData: Uint8Array): Promise<void> {
    if (!this.encoder || this.encoder.state !== 'configured') {
      throw new Error('Encoder not initialized');
    }

    try {
      // Convert PNG to ImageData
      const blob = new Blob([imageData as any], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      
      // Draw to canvas to get raw frame data
      const canvas = new OffscreenCanvas(this.width, this.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      
      ctx.drawImage(bitmap, 0, 0);
      
      // Add frame to WebM writer
      const dataUrl = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })
        .then(blob => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }));
      
      this.writer.addFrame(dataUrl, this.frameCount * 100); // 100ms per frame (10 FPS)
      this.frameCount++;
    } catch (error) {
      console.error('Error adding frame:', error);
    }
  }

  async finishRecording(): Promise<Uint8Array> {
    if (!this.encoder || !this.writer) {
      throw new Error('No recording in progress');
    }

    // Close encoder
    if (this.encoder.state === 'configured') {
      await this.encoder.flush();
    }
    this.encoder.close();
    this.encoder = null;

    // Complete WebM file
    return new Promise((resolve) => {
      this.writer.complete().then((blob: Blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          resolve(new Uint8Array(arrayBuffer));
        };
        reader.readAsArrayBuffer(blob);
      });
    });
  }
}

// Simpler alternative using just canvas recording (no WebCodecs)
export class CanvasRecorder {
  private writer: any = null;
  private frameCount = 0;
  private width = 0;
  private height = 0;
  private startTime = 0;
  private lastFrameTime = 0;

  async startRecording(width: number, height: number): Promise<void> {
    this.frameCount = 0;
    this.width = width;
    this.height = height;
    this.startTime = Date.now();
    this.lastFrameTime = this.startTime;

    // Initialize WebM writer
    this.writer = new WebMWriter({
      quality: 0.85,
      frameRate: 10,
      transparent: false,
    });
  }

  async addFrame(imageData: Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error('Recorder not initialized');
    }

    try {
      // Create an image element from the PNG data
      const blob = new Blob([imageData as any], { type: 'image/png' });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      // Create a canvas and draw the image
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      ctx.drawImage(img, 0, 0);
      
      // Calculate actual elapsed time since start
      const currentTime = Date.now();
      const elapsedTime = currentTime - this.startTime;
      
      // Add frame with actual timestamp
      this.writer.addFrame(canvas, elapsedTime);
      this.frameCount++;
      this.lastFrameTime = currentTime;
      
      console.log(`[Recording] Frame ${this.frameCount} at ${elapsedTime}ms`);
    } catch (error) {
      console.error('Error adding frame:', error);
    }
  }

  async finishRecording(): Promise<Uint8Array> {
    if (!this.writer) {
      throw new Error('No recording in progress');
    }

    const totalDuration = Date.now() - this.startTime;
    console.log(`[Recording] Finishing recording. Total duration: ${totalDuration}ms, Frames: ${this.frameCount}`);

    // Complete WebM file
    const blob = await this.writer.complete();
    const arrayBuffer = await blob.arrayBuffer();
    
    this.writer = null;
    this.frameCount = 0;
    
    return new Uint8Array(arrayBuffer);
  }
}