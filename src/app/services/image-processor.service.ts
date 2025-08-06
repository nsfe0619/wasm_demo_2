import { Injectable } from '@angular/core';
import { ImageProcessor } from './image-processors/image-processor.interface';
import { CanvasProcessorService } from './image-processors/canvas-processor.service';
import { AssemblyScriptProcessorService } from './image-processors/assemblyscript-processor.service';
import { ImageMagickProcessorService } from './image-processors/imagemagick-processor.service';
import { OpenCVProcessorService } from './image-processors/opencv-processor.service';

export type ProcessorInfo = {
  id: string;
  name: string;
  description: string;
  processor: ImageProcessor;
};

@Injectable({
  providedIn: 'root'
})
export class ImageProcessorService {
  private processors: ProcessorInfo[] = [];
  private currentProcessor: ImageProcessor | null = null;
  
  constructor(
    private canvasProcessor: CanvasProcessorService,
    private assemblyScriptProcessor: AssemblyScriptProcessorService,
    private imageMagickProcessor: ImageMagickProcessorService,
    private openCVProcessor: OpenCVProcessorService
  ) {
    // 註冊所有可用的處理器
    this.registerProcessor('canvas', 'Canvas 2D', '使用瀏覽器內建的 Canvas 2D API 進行影像處理', this.canvasProcessor);
    this.registerProcessor('assemblyscript', 'AssemblyScript', '使用 WebAssembly 進行高效能影像處理', this.assemblyScriptProcessor);
    this.registerProcessor('imagemagick', 'ImageMagick (WASM)', '使用 WebAssembly 編譯的 ImageMagick 進行圖片處理', this.imageMagickProcessor);
    this.registerProcessor('opencv', 'OpenCV.js', '強大的計算機視覺庫', this.openCVProcessor);
    
    // 預設使用 Canvas 處理器
    this.setCurrentProcessor('canvas');
  }
  
  private registerProcessor(id: string, name: string, description: string, processor: ImageProcessor): void {
    this.processors.push({
      id,
      name,
      description,
      processor
    });
  }
  
  getAvailableProcessors(): ProcessorInfo[] {
    return this.processors.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      processor: p.processor
    }));
  }
  
  getCurrentProcessor(): ImageProcessor | null {
    return this.currentProcessor;
  }
  
  setCurrentProcessor(processorId: string): boolean {
    const processorInfo = this.processors.find(p => p.id === processorId);
    if (processorInfo) {
      this.currentProcessor = processorInfo.processor;
      return true;
    }
    return false;
  }
  
  async getProcessor(processorId: string): Promise<ImageProcessor | null> {
    const processorInfo = this.processors.find(p => p.id === processorId);
    if (!processorInfo) return null;
    
    // 確保處理器已初始化
    try {
      await processorInfo.processor.init();
      return processorInfo.processor;
    } catch (error) {
      console.error(`初始化處理器 ${processorId} 失敗:`, error);
      return null;
    }
  }
  
  async processImage(imageData: ImageData, processorId?: string): Promise<{
    result: ImageData;
    processingTime: number;
    processor: ImageProcessor;
  } | null> {
    const processor = processorId 
      ? await this.getProcessor(processorId)
      : this.currentProcessor;
    
    if (!processor) {
      throw new Error('沒有可用的影像處理器');
    }
    
    try {
      const result = await processor.process(imageData);
      return {
        ...result,
        processor
      };
    } catch (error) {
      console.error('影像處理失敗:', error);
      throw error;
    }
  }
}
