import { Injectable } from '@angular/core';
import { ImageProcessor } from './image-processor.interface';
import * as Magick from 'wasm-imagemagick';

declare const window: any;

interface MagickFile {
  name: string;
  content: Uint8Array;
}

interface CallResult {
  exitCode: number;
  stdout: string[];
  stderr: string[];
  outputFiles: {
    name: string;
    buffer: ArrayBuffer;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class ImageMagickProcessorService implements ImageProcessor {
  name = 'ImageMagick (WASM)';
  description = '使用 WebAssembly 編譯的 ImageMagick 進行圖片處理';
  
  private initialized = false;
  private initializedTime: number | null = null;
  private lastProcessingTime: number = 0;
  private baseHref: string;

  constructor() { 
    // 設置 wasm 檔案的基本路徑
    this.baseHref = document.getElementsByTagName('base')[0]?.getAttribute('href') || '/';
    
    // 確保 baseHref 以斜線結尾
    if (!this.baseHref.endsWith('/')) {
      this.baseHref += '/';
    }
    
    // 使用 assets 目錄中的 wasm 文件
    window.IMAGEMAGICK_WASM = this.baseHref + 'wasm-imagemagick/magick.wasm';
    
    // 預先設置 worker 腳本路徑
    if (!window.MagickConfig) {
      window.MagickConfig = {};
    }
    
    // 設置為 assets 目錄中的路徑
    window.MagickConfig.scriptPath = this.baseHref + 'wasm-imagemagick/';
    
    console.log('ImageMagick configuration:', {
      wasmPath: window.IMAGEMAGICK_WASM,
      scriptPath: window.MagickConfig.scriptPath
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    const startTime = performance.now();
    
    try {
      // 初始化 ImageMagick
      await this.initializeMagick();
      this.initialized = true;
      this.initializedTime = performance.now() - startTime;
      console.log('ImageMagick 初始化完成，耗時:', this.initializedTime, 'ms');
    } catch (error) {
      console.error('初始化 ImageMagick 時出錯:', error);
      this.initialized = false;
      throw error;
    }
  }

  private async initializeMagick(): Promise<void> {
    try {
      console.log('Initializing ImageMagick...');
      
      // 創建一個小的測試圖片進行初始化
      const testImage = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const inputFiles = [{
        name: 'test.png',
        content: testImage
      }];
      
      // 執行一個簡單的轉換來初始化 ImageMagick
      console.log('Running test conversion...');
      const result = await (Magick.call as any)(inputFiles, ['convert', 'test.png', '-resize', '1x1', 'output.png']);
      
      if (!result || result.exitCode !== 0) {
        throw new Error(`ImageMagick test conversion failed with code ${result?.exitCode}`);
      }
      
      console.log('ImageMagick initialized successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize ImageMagick:', error);
      throw new Error(`ImageMagick 初始化失敗: ${errorMessage}`);
    }
  }

  isSupported(): boolean {
    return true; // 假設現代瀏覽器都支援
  }

  getStatus(): { initialized: boolean; initializedTime: number | null; lastProcessingTime: number } {
    return {
      initialized: this.initialized,
      initializedTime: this.initializedTime,
      lastProcessingTime: this.lastProcessingTime
    };
  }

  private async loadImage(buffer: ArrayBuffer): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('無法載入圖片'));
      };
      
      img.src = url;
    });
  }

  async process(imageData: ImageData): Promise<{ result: ImageData; processingTime: number }> {
    if (!this.initialized) {
      await this.init();
    }

    const startTime = performance.now();
    
    try {
      const { width, height } = imageData;
      
      // 創建一個臨時的 canvas 來處理圖片
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('無法獲取 Canvas 2D 上下文');
      }
      
      // 將 ImageData 繪製到 canvas
      ctx.putImageData(imageData, 0, 0);
      
      // 將 canvas 轉換為 Blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('無法將圖片轉換為 Blob'));
          }
        }, 'image/png');
      });
      
      // 讀取 Blob 為 ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 創建輸入文件
      const inputFiles = [{
        name: 'input.png',
        content: uint8Array
      }];
      
      // 執行 ImageMagick 轉換
      console.log('Processing image with ImageMagick...');
      const result = await (Magick.call as any)(
        inputFiles,
        ['convert', 'input.png', '-colorspace', 'gray', 'output.png']
      );
      
      if (!result || result.exitCode !== 0) {
        throw new Error(`ImageMagick 處理失敗，錯誤碼: ${result?.exitCode}`);
      }
      
      // 獲取處理後的圖片數據
      const outputFile = result.outputFiles.find((f: any) => f.name === 'output.png');
      if (!outputFile) {
        throw new Error('無法獲取處理後的圖片數據');
      }
      
      // 將 ArrayBuffer 轉換為 ImageData
      const img = await this.loadImage(outputFile.buffer);
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = img.width;
      outputCanvas.height = img.height;
      const outputCtx = outputCanvas.getContext('2d');
      
      if (!outputCtx) {
        throw new Error('無法獲取輸出 Canvas 2D 上下文');
      }
      
      outputCtx.drawImage(img, 0, 0);
      const outputImageData = outputCtx.getImageData(0, 0, img.width, img.height);
      
      this.lastProcessingTime = performance.now() - startTime;
      
      return {
        result: outputImageData,
        processingTime: this.lastProcessingTime
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('圖片處理出錯:', error);
      throw new Error(`圖片處理失敗: ${errorMessage}`);
    }
  }
}
