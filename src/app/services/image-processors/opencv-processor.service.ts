import { Injectable } from '@angular/core';
import { ImageProcessor } from './image-processor.interface';

// 聲明 OpenCV.js 的類型
declare var cv: any;

@Injectable({
  providedIn: 'root'
})
export class OpenCVProcessorService implements ImageProcessor {
  name = 'OpenCV.js';
  description = '使用 OpenCV.js 進行高效能影像處理。功能最完整但初始化時間較長，適合需要複雜計算機視覺功能的場景。';
  
  private initialized = false;
  private lastProcessingTime: number | null = null;
  private initializedTime: number | null = null;
  
  constructor() {
    // 加載 OpenCV.js 腳本
    this.loadOpenCV();
  }
  
  private loadOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof cv !== 'undefined' && cv.getBuildInformation) {
        console.log('OpenCV.js 已加載');
        resolve();
        return;
      }
      
      console.log('正在加載 OpenCV.js...');
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.5.5/opencv.js';
      script.async = true;
      script.onload = () => {
        // 等待 OpenCV 完全初始化
        const checkReady = setInterval(() => {
          if (typeof cv !== 'undefined' && cv.getBuildInformation) {
            clearInterval(checkReady);
            console.log('OpenCV.js 加載完成');
            resolve();
          }
        }, 50);
      };
      script.onerror = () => {
        reject(new Error('無法加載 OpenCV.js'));
      };
      document.body.appendChild(script);
    });
  }
  
  async init(): Promise<void> {
    if (this.initialized) return;
    
    const startTime = performance.now();
    
    try {
      // 等待 OpenCV.js 加載完成
      await this.loadOpenCV();
      
      // 執行一個簡單的操作來確保 OpenCV 已準備好
      const mat = new cv.Mat();
      mat.delete();
      
      this.initialized = true;
      this.initializedTime = performance.now() - startTime;
      
      console.log('OpenCVProcessor 初始化完成，耗時:', this.initializedTime, 'ms');
    } catch (error) {
      console.error('初始化 OpenCV 處理器失敗:', error);
      throw error;
    }
  }
  
  async process(imageData: ImageData): Promise<{ result: ImageData; processingTime: number; }> {
    if (!this.initialized) {
      await this.init();
    }
    
    const startTime = performance.now();
    
    try {
      const { width, height, data } = imageData;
      
      // Create a temporary canvas to handle the image data
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      // Put the image data onto the canvas
      const imgData = new ImageData(new Uint8ClampedArray(data), width, height);
      ctx.putImageData(imgData, 0, 0);
      
      // Create OpenCV Mat from the canvas
      const src = cv.imread(canvas);
      const dst = new cv.Mat();
      
      // Convert to grayscale
      cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
      
      // Convert back to RGBA
      cv.cvtColor(src, dst, cv.COLOR_GRAY2RGBA);
      
      // Create a new canvas for the result
      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = width;
      resultCanvas.height = height;
      const resultCtx = resultCanvas.getContext('2d');
      
      if (!resultCtx) {
        throw new Error('Could not get result canvas context');
      }
      
      // Convert the result back to ImageData
      cv.imshow(resultCanvas, dst);
      const result = resultCtx.getImageData(0, 0, width, height);
      
      // Clean up
      src.delete();
      dst.delete();
      
      this.lastProcessingTime = performance.now() - startTime;
      
      return {
        result,
        processingTime: this.lastProcessingTime
      };
    } catch (error) {
      console.error('OpenCV 處理圖片時發生錯誤:', error);
      throw error;
    }
  }
  
  isSupported(): boolean {
    return true; // 由腳本加載，理論上總是支援
  }
  
  getStatus() {
    return {
      initialized: this.initialized,
      lastProcessingTime: this.lastProcessingTime,
      initializedTime: this.initializedTime
    };
  }
}
