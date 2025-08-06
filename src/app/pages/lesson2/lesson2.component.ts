import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ImageProcessorService, ProcessorInfo } from '../../services/image-processor.service';

@Component({
  selector: 'app-lesson2',
  standalone: true,
  templateUrl: './lesson2.component.html',
  styleUrls: ['./lesson2.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    // Angular Material Modules
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatOptionModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule
  ]
})
export class Lesson2Component implements OnInit {
  selectedFile: File | null = null;
  originalImage: string | null = null;
  processedImage: string | null = null;
  isProcessing = false;
  processingTime = 0;
  dragOver = false;

  // 處理器相關
  availableProcessors: ProcessorInfo[] = [];
  selectedProcessorId = 'canvas';
  processorInitializing = new Map<string, boolean>(); // 追蹤處理器初始化狀態
  processorStatus: { [key: string]: any } = {};

  // 處理結果
  results: Array<{
    processorId: string;
    processorName: string;
    result: string;
    processingTime: number;
    initializedTime: number | null;
  }> = [];

  constructor(private imageProcessorService: ImageProcessorService) {
    // 初始化處理器狀態
    this.availableProcessors = this.imageProcessorService.getAvailableProcessors();
    this.availableProcessors.forEach(proc => {
      this.processorInitializing.set(proc.id, false);
    });
  }

  async ngOnInit(): Promise<void> {
    // 預先載入 AssemblyScript 處理器
    await this.preloadAssemblyScript();

    this.availableProcessors = this.imageProcessorService.getAvailableProcessors();

    // 初始化所有處理器
    for (const processor of this.availableProcessors) {
      try {
        this.processorInitializing.set(processor.id, true);
        
        // 如果是 OpenCV 處理器，設置狀態監聽器
        if (processor.id === 'opencv') {
          const opencvProcessor = processor.processor as any;
          if (opencvProcessor.setStatusChangeListener) {
            opencvProcessor.setStatusChangeListener((initialized: boolean) => {
              console.log(`OpenCV 初始化狀態: ${initialized ? '完成' : '進行中'}`);
              this.processorInitializing.set(processor.id, !initialized);
            });
          }
        }
        
        await processor.processor.init();
        this.processorStatus[processor.id] = {
          ...processor.processor.getStatus(),
          supported: true
        };
      } catch (error) {
        console.error(`處理器 ${processor.name} 初始化失敗:`, error);
        this.processorStatus[processor.id] = {
          supported: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        this.processorInitializing.set(processor.id, false);
      }
    }
  }

  onFileSelected(event: any): void {
    const file = event?.target?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.processFile(file);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer?.files?.length) return;

    const file = event.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      this.processFile(file);
    } else {
      alert('請選擇有效的圖片檔案 (JPG, PNG 等)');
    }
  }

  private processFile(file: File): void {
    this.selectedFile = file;
    this.previewOriginalImage(file);
  }

  private previewOriginalImage(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 計算縮略圖尺寸，保持縱橫比
        const maxHeight = 300;
        let width = img.width;
        let height = img.height;

        if (height > maxHeight) {
          const ratio = maxHeight / height;
          width = width * ratio;
          height = maxHeight;
        }

        // 創建 canvas 來調整圖片大小
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          this.originalImage = canvas.toDataURL('image/jpeg', 0.9);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  private async processWithSelectedProcessor(imageData: ImageData): Promise<{
    result: ImageData;
    processingTime: number;
  }> {
    try {
      const processor = await this.imageProcessorService.getProcessor(this.selectedProcessorId);
      if (!processor) {
        throw new Error(`找不到處理器: ${this.selectedProcessorId}`);
      }

      const startTime = performance.now();
      const result = await processor.process(imageData);
      const processingTime = performance.now() - startTime;

      return {
        result: result.result,
        processingTime
      };
    } catch (error) {
      console.error('處理圖片時發生錯誤:', error);
      throw error;
    }
  }

  private imageDataToDataUrl(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法獲取 Canvas 2D 上下文');

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  private getImageDataFromImageElement(image: HTMLImageElement): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法獲取 Canvas 2D 上下文');

    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, image.width, image.height);
  }

  private async preloadAssemblyScript(): Promise<void> {
    const assemblyScriptProcessor = this.availableProcessors.find(p => p.id === 'assemblyscript');
    if (assemblyScriptProcessor) {
      try {
        this.processorInitializing.set('assemblyscript', true);
        const processor = this.imageProcessorService.getProcessor('assemblyscript');
        if (processor && 'preload' in processor) {
          await (processor as any).preload();
        }
      } catch (error) {
        console.error('預載入 AssemblyScript 失敗:', error);
      } finally {
        this.processorInitializing.set('assemblyscript', false);
      }
    }
  }

  async onUpload(): Promise<void> {
    if (!this.selectedFile || !this.originalImage) {
      alert('請先選擇一張圖片');
      return;
    }

    this.isProcessing = true;
    this.results = [];
    console.log('開始處理圖片:', this.selectedFile.name);

    try {
      // 載入原始圖片到 Image 對象
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('載入圖片失敗'));
        img.src = this.originalImage!;
      });

      // 獲取圖片的 ImageData
      const imageData = this.getImageDataFromImageElement(img);

      // 使用選定的處理器處理圖片
      const processor = this.availableProcessors.find(p => p.id === this.selectedProcessorId);
      if (!processor) {
        throw new Error(`找不到處理器: ${this.selectedProcessorId}`);
      }

      const startTime = performance.now();
      const result = await this.processWithSelectedProcessor(imageData);
      const endTime = performance.now();

      // 更新處理結果
      this.processingTime = endTime - startTime;
      this.processedImage = this.imageDataToDataUrl(result.result);

      // 添加到結果列表
      this.results.push({
        processorId: processor.id,
        processorName: processor.name,
        result: this.processedImage,
        processingTime: result.processingTime,
        initializedTime: this.processorStatus[processor.id]?.initializedTime || null
      });

      console.log('圖片處理完成，耗時:', this.processingTime, 'ms');
    } catch (error) {
      console.error('圖片處理失敗:', error);
      alert(`圖片處理失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      this.isProcessing = false;
    }
  }

  async compareAllProcessors(): Promise<void> {
    if (!this.selectedFile || !this.originalImage) {
      alert('請先選擇一張圖片');
      return;
    }

    this.isProcessing = true;
    this.results = [];
    console.log('開始比較所有處理器...');

    try {
      // 載入原始圖片到 Image 對象
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('載入圖片失敗'));
        img.src = this.originalImage!;
      });

      // 獲取圖片的 ImageData
      const imageData = this.getImageDataFromImageElement(img);

      // 為每個處理器處理圖片
      for (const processor of this.availableProcessors) {
        if (!this.processorStatus[processor.id]?.supported) continue;

        try {
          this.selectedProcessorId = processor.id;
          console.log(`使用處理器: ${processor.name}`);

          const startTime = performance.now();
          const result = await this.processWithSelectedProcessor(imageData);
          const endTime = performance.now();

          // 添加到結果列表
          this.results.push({
            processorId: processor.id,
            processorName: processor.name,
            result: this.imageDataToDataUrl(result.result),
            processingTime: result.processingTime,
            initializedTime: this.processorStatus[processor.id]?.initializedTime || null
          });

          console.log(`${processor.name} 處理完成，耗時: ${result.processingTime.toFixed(2)}ms`);
        } catch (error) {
          console.error(`處理器 ${processor.name} 處理失敗:`, error);
          // 繼續下一個處理器
        }
      }

      if (this.results.length === 0) {
        throw new Error('沒有可用的處理器完成處理');
      }

      // 按處理時間排序
      this.results.sort((a, b) => a.processingTime - b.processingTime);

    } catch (error) {
      console.error('比較處理器時發生錯誤:', error);
      alert(`比較處理器時發生錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      this.isProcessing = false;
    }
  }

  clearSelection(): void {
    this.selectedFile = null;
    this.originalImage = null;
    this.processedImage = null;
    this.results = [];
  }

  trackByProcessorId(index: number, item: any): string {
    return item.processorId;
  }

  /**
   * 下載處理後的圖片
   * @param imageData 圖片的 data URL
   * @param processorName 處理器名稱，用於設定下載檔案名稱
   */
  downloadImage(imageData: string, processorName: string): void {
    if (!imageData) return;

    try {
      // 建立下載連結
      const link = document.createElement('a');
      link.href = imageData;

      // 設定下載檔案名稱
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = imageData.split(';')[0].split('/')[1];
      const filename = `wasm-image-${processorName}-${timestamp}.${extension}`;

      link.download = filename;

      // 觸發點擊下載
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('下載圖片時發生錯誤:', error);
      alert('下載圖片時發生錯誤，請稍後再試');
    }
  }
}
