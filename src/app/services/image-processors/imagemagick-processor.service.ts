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

  constructor() { 
    // 設置 wasm 檔案的基本路徑
    const baseHref = document.getElementsByTagName('base')[0]?.getAttribute('href') || '/';
    window.IMAGEMAGICK_WASM = `${baseHref}assets/wasm-imagemagick/magick.wasm`;
    
    // 預先設置 worker 腳本路徑
    if (!window.MagickConfig) {
      window.MagickConfig = {};
    }
    window.MagickConfig.scriptPath = `${baseHref}assets/wasm-imagemagick/`;
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
      throw error;
    }
  }

  private async initializeMagick(): Promise<void> {
    // 創建一個空的輸入文件和轉換命令來初始化
    const inputFiles = [{
      name: 'input.png',
      content: new Uint8Array()
    }];
    
    // 執行一個空的轉換來初始化 ImageMagick
    await (Magick.call as any)(inputFiles, ['convert', 'input.png', 'output.png']);
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
      if (!ctx) throw new Error('無法獲取 Canvas 2D 上下文');
      
      // 將 ImageData 繪製到 canvas
      ctx.putImageData(imageData, 0, 0);
      
      // 將 canvas 轉換為 Blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('無法將 canvas 轉換為 Blob'));
          }
        }, 'image/png');
      });
      
      // 將 Blob 轉換為 Uint8Array
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 準備輸入文件
      const inputFiles = [{
        name: 'input.png',
        content: uint8Array
      }];
      
      // 執行 ImageMagick 轉換（轉為灰階）
      const magickResult = await (Magick.call as any)(inputFiles, [
        'convert', 'input.png', 
        '-colorspace', 'gray',
        'output.png'
      ]);
      
      // 獲取處理後的圖片數據
      const outputFile = magickResult.outputFiles.find((f: any) => f.name === 'output.png');
      if (!outputFile) {
        throw new Error('ImageMagick 處理失敗：無輸出文件');
      }
      
      // 創建一個新的 Image 對象來載入處理後的圖片
      const img = new Image();
      const imgBlob = new Blob([outputFile.buffer], { type: 'image/png' });
      const imgUrl = URL.createObjectURL(imgBlob);
      
      // 等待圖片載入
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error('無法載入處理後的圖片'));
        img.src = imgUrl;
      });
      
      // 將處理後的圖片繪製到 canvas
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // 從 canvas 獲取處理後的 ImageData
      const processedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // 釋放 URL 對象
      URL.revokeObjectURL(imgUrl);
      
      const processingTime = performance.now() - startTime;
      this.lastProcessingTime = processingTime;
      
      return {
        result: processedImageData,
        processingTime
      };
    } catch (error) {
      console.error('ImageMagick 處理圖片時發生錯誤:', error);
      throw error;
    }
  }
}
