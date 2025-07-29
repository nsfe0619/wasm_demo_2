import { Injectable } from '@angular/core';
import { ImageProcessor } from './image-processor.interface';

@Injectable({
  providedIn: 'root'
})
export class CanvasProcessorService implements ImageProcessor {
  name = 'Canvas 2D';
  description = '使用瀏覽器內建的 Canvas 2D API 進行影像處理。優點是實現簡單，無需額外依賴，但性能較差。';
  
  private initialized = false;
  private lastProcessingTime: number | null = null;
  private initializedTime: number | null = null;
  
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('無法獲取 Canvas 2D 上下文');
    }
    this.ctx = ctx;
  }
  
  async init(): Promise<void> {
    if (this.initialized) return;
    
    // Canvas 不需要特別的初始化
    this.initialized = true;
    this.initializedTime = 1; // 假設初始化時間為 1ms
    console.log('CanvasProcessor 初始化完成');
  }
  
  async process(imageData: ImageData): Promise<{ result: ImageData; processingTime: number; }> {
    if (!this.initialized) {
      await this.init();
    }
    
    const startTime = performance.now();
    
    try {
      // 設置 Canvas 尺寸
      this.canvas.width = imageData.width;
      this.canvas.height = imageData.height;
      
      // 繪製原始圖像
      this.ctx.putImageData(imageData, 0, 0);
      
      // 獲取圖像數據
      const imageDataOut = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const data = imageDataOut.data;
      
      // 轉換為灰階
      for (let i = 0; i < data.length; i += 4) {
        // 使用亮度公式：0.299*R + 0.587*G + 0.114*B
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = avg;     // R
        data[i + 1] = avg; // G
        data[i + 2] = avg; // B
      }
      
      // 放回處理後的圖像數據
      this.ctx.putImageData(imageDataOut, 0, 0);
      
      const endTime = performance.now();
      this.lastProcessingTime = endTime - startTime;
      
      return {
        result: imageDataOut,
        processingTime: this.lastProcessingTime
      };
    } catch (error) {
      console.error('Canvas 處理圖片時發生錯誤:', error);
      throw error;
    }
  }
  
  isSupported(): boolean {
    return !!document.createElement('canvas').getContext('2d');
  }
  
  getStatus() {
    return {
      initialized: this.initialized,
      lastProcessingTime: this.lastProcessingTime,
      initializedTime: this.initializedTime
    };
  }
}
