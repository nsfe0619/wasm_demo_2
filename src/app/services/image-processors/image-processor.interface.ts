export interface ImageProcessor {
  name: string;
  description: string;
  
  /**
   * 初始化處理器
   */
  init(): Promise<void>;
  
  /**
   * 處理圖片
   * @param imageData 原始圖片數據
   * @returns 處理後的圖片數據
   */
  process(imageData: ImageData): Promise<{
    result: ImageData;
    processingTime: number;
  }>;
  
  /**
   * 檢查是否支援當前環境
   */
  isSupported(): boolean;
  
  /**
   * 獲取處理器狀態
   */
  getStatus(): {
    initialized: boolean;
    lastProcessingTime: number | null;
    initializedTime: number | null;
  };
}
