import { Injectable } from '@angular/core';
import { ImageProcessor } from './image-processor.interface';
import * as loader from '@assemblyscript/loader';

type GrayscaleWasmExports = {
  memory: WebAssembly.Memory;
  grayscale: (width: number, height: number, inputPtr: number, outputPtr: number) => void;
} & Record<string, any>;

@Injectable({
  providedIn: 'root'
})
export class AssemblyScriptProcessorService implements ImageProcessor {
  name = 'AssemblyScript';
  description = '使用 AssemblyScript 編譯的 WebAssembly 進行高效能影像處理。性能接近原生代碼，適合需要高效能的場景。';
  
  private initialized = false;
  private wasmExports: GrayscaleWasmExports | null = null;
  private lastProcessingTime: number | null = null;
  private initializedTime: number | null = null;
  private initPromise: Promise<void> | null = null;
  
  // 預先載入 WASM 模組
  preload(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = this._initWasm();
    return this.initPromise;
  }
  
  async init(): Promise<void> {
    if (this.initialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    return this.preload();
  }
  
  private async _initWasm(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // 載入並實例化 WASM 模組
      const wasmPath = 'assets/wasm/grayscale.wasm';
      console.log('Loading WASM from:', wasmPath);
      
      const response = await fetch(wasmPath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const wasmBuffer = await response.arrayBuffer();
      
      const wasmModule = await loader.instantiate<GrayscaleWasmExports>(
        wasmBuffer,
        {
          env: {
            memory: new WebAssembly.Memory({ initial: 10, maximum: 100 })
          }
        }
      );
      
      if (!wasmModule || !wasmModule.exports) {
        throw new Error('Failed to instantiate WebAssembly module');
      }
      
      this.wasmExports = wasmModule.exports;
      this.initialized = true;
      this.initializedTime = performance.now() - startTime;
      console.log('WASM module loaded successfully in', this.initializedTime, 'ms');
    } catch (error) {
      console.error('Error initializing WASM module:', error);
      this.initPromise = null; // 重置 promise 以允許重試
      throw error;
    }
  }
  
  async process(imageData: ImageData): Promise<{ result: ImageData; processingTime: number; }> {
    if (!this.initialized || !this.wasmExports) {
      await this.init();
    }
    
    const startTime = performance.now();
    
    try {
      const { memory, grayscale } = this.wasmExports!;
      const { width, height, data } = imageData;
      
      // 計算需要的記憶體大小 (RGBA 4 bytes per pixel)
      const numBytes = width * height * 4;
      
      // 確保記憶體足夠
      const memoryNeeded = (numBytes * 2 + 0xffff) & ~0xffff; // 對齊到 64KB 頁面
      const pagesNeeded = Math.ceil(memoryNeeded / 65536);
      const currentPages = memory.buffer.byteLength / 65536;
      
      if (pagesNeeded > currentPages) {
        memory.grow(pagesNeeded - currentPages);
      }
      
      // 獲取記憶體視圖
      const wasmMemory = new Uint8Array(memory.buffer);
      
      // 分配輸入和輸出緩衝區
      const inputPtr = 0;
      const outputPtr = numBytes;
      
      // 複製輸入數據到 WASM 記憶體
      wasmMemory.set(new Uint8Array(data.buffer), inputPtr);
      
      // 呼叫 WASM 函數處理圖片
      grayscale(width, height, inputPtr, outputPtr);
      
      // 從 WASM 記憶體中讀取處理後的數據
      const resultData = new Uint8ClampedArray(wasmMemory.slice(outputPtr, outputPtr + numBytes));
      
      // 創建新的 ImageData 對象
      const result = new ImageData(resultData, width, height);
      
      this.lastProcessingTime = performance.now() - startTime;
      
      return {
        result,
        processingTime: this.lastProcessingTime
      };
    } catch (error) {
      console.error('AssemblyScript 處理圖片時發生錯誤:', error);
      throw error;
    }
  }
  
  isSupported(): boolean {
    return typeof WebAssembly === 'object' && 
           typeof WebAssembly.instantiate === 'function';
  }
  
  getStatus() {
    return {
      initialized: this.initialized,
      lastProcessingTime: this.lastProcessingTime,
      initializedTime: this.initializedTime
    };
  }
}
