import { Injectable, NgZone, isDevMode } from '@angular/core';
import { ImageProcessor } from './image-processor.interface';

// OpenCV.js Type Definitions
interface OpenCV {
  // Core functionality
  Mat: new () => any;
  matFromImageData: (imageData: ImageData) => any;
  cvtColor: (src: any, dst: any, code: number, dstCn?: number) => void;
  
  // Constants
  COLOR_RGBA2GRAY: number;
  COLOR_GRAY2RGBA: number;
  
  // Initialization
  onRuntimeInitialized?: () => void;
  getBuildInformation?: () => string;
  
  // Additional properties that might be present
  [key: string]: any;
}

declare global {
  interface Window {
    cv: OpenCV;
  }
}

// Global OpenCV instance
declare const cv: OpenCV;

@Injectable({
  providedIn: 'root'
})
export class OpenCVProcessorService implements ImageProcessor {
  name = 'OpenCV.js';
  description = '使用 OpenCV.js 進行高效能影像處理。功能最完整但初始化時間較長，適合需要複雜計算機視覺功能的場景。';
  
  private static _initialized = false;
  private static initializationPromise: Promise<void> | null = null;
  private lastProcessingTime: number | null = null;
  private initializedTime: number | null = null;
  
  // 初始化狀態變更的回調函數
  private onStatusChange: ((initialized: boolean) => void) | null = null;
  
  constructor(private ngZone: NgZone) {}
  
  // 設置狀態變更監聽器
  setStatusChangeListener(callback: (initialized: boolean) => void): void {
    this.onStatusChange = callback;
    // 立即通知當前狀態
    if (this.onStatusChange) {
      this.onStatusChange(OpenCVProcessorService._initialized);
    }
  }
  
  private async loadOpenCVFromCDN(): Promise<boolean> {
    console.log('Attempting to load OpenCV.js from CDN...');
    try {
      // First try the main CDN URL
      await this.loadScript('https://docs.opencv.org/4.5.5/opencv.js');
      console.log('OpenCV.js script loaded from CDN, verifying...');
      
      // Wait for OpenCV to initialize
      await this.waitForOpenCV(30000); // 30 second timeout for CDN
      
      if (!window.cv) {
        throw new Error('window.cv is not defined after loading OpenCV.js');
      }
      
      console.log('OpenCV object available, checking core modules...');
      
      if (!this.checkOpenCVModules()) {
        console.warn('OpenCV loaded but core modules are not available, trying alternative CDN...');
        
        // Try alternative CDN if first one fails
        await this.loadScript('https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js');
        console.log('Alternative OpenCV.js script loaded, verifying...');
        
        await this.waitForOpenCV(30000);
        
        if (!window.cv || !this.checkOpenCVModules()) {
          throw new Error('Failed to load OpenCV.js with core modules from CDN');
        }
      }
      
      console.log('OpenCV.js loaded successfully from CDN');
      return true;
    } catch (error) {
      console.warn('Failed to load OpenCV.js from CDN:', error);
      return false;
    }
  }

  private async loadOpenCVFromLocal(): Promise<boolean> {
    console.log('Attempting to load OpenCV.js from local assets...');
    try {
      // First try the standard path
      await this.loadScript('assets/opencv/opencv.js');
      console.log('OpenCV.js script loaded from local assets, verifying...');
      
      // Wait for OpenCV to initialize
      await this.waitForOpenCV(30000);
      
      if (!window.cv) {
        throw new Error('window.cv is not defined after loading OpenCV.js from local assets');
      }
      
      console.log('Local OpenCV object available, checking core modules...');
      
      if (!this.checkOpenCVModules()) {
        console.warn('Local OpenCV loaded but core modules are not available');
        console.log('Available OpenCV methods:', window.cv ? Object.keys(window.cv).filter(k => !k.startsWith('_')) : 'none');
        console.log('Trying to initialize with cv.onRuntimeInitialized...');
        
        // Try to use the onRuntimeInitialized callback
        const initialized = await new Promise<boolean>((resolve) => {
          if (window.cv && window.cv.onRuntimeInitialized) {
            window.cv.onRuntimeInitialized = () => {
              console.log('OpenCV runtime initialized via callback');
              resolve(this.checkOpenCVModules());
            };
            // Set a timeout in case the callback never fires
            setTimeout(() => resolve(false), 10000);
          } else {
            resolve(false);
          }
        });
        
        if (!initialized) {
          throw new Error('Failed to initialize OpenCV core modules');
        }
      }
      
      console.log('OpenCV.js loaded successfully from local assets');
      return true;
    } catch (error) {
      console.error('Failed to load OpenCV.js from local assets:', error);
      return false;
    }
  }

  private async loadOpenCV(): Promise<void> {
    console.log('Starting OpenCV.js load process...');
    return new Promise<void>(async (resolve, reject) => {
      // Check if already loaded
      if (window.cv) {
        console.log('OpenCV.js already loaded');
        return resolve();
      }

      const loadScript = (src: string): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
          console.log(`Attempting to load script: ${src}`);
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          script.onload = () => {
            console.log(`Successfully loaded script: ${src}`);
            // Check if OpenCV is properly exposed
            if (!window.cv) {
              console.warn(`Script loaded but window.cv is not available: ${src}`);
              reject(new Error(`OpenCV not properly exposed in window.cv after loading ${src}`));
              return;
            }
            console.log('OpenCV object available with keys:', Object.keys(window.cv).filter(k => !k.startsWith('_')));
            resolve();
          };
          script.onerror = (error) => {
            console.error(`Failed to load script: ${src}`, error);
            reject(new Error(`Failed to load script: ${src}`));
          };
          document.head.appendChild(script);
        });
      };

      try {
        // Try CDN first
        const loadedFromCDN = await this.loadOpenCVFromCDN();
        
        if (!loadedFromCDN) {
          console.warn('Falling back to local OpenCV.js...');
          const loadedFromLocal = await this.loadOpenCVFromLocal();
          
          if (!loadedFromLocal) {
            throw new Error('Failed to load OpenCV.js from both CDN and local assets');
          }
        }
        
        resolve();
      } catch (error) {
        console.error('Failed to load OpenCV.js from any source:', error);
        reject(new Error(`Failed to load OpenCV.js: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  private async initialize(): Promise<void> {
    if (OpenCVProcessorService._initialized) {
      console.log('OpenCV processor already initialized');
      return;
    }

    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Starting OpenCV initialization...`);

    if (this.onStatusChange) {
      this.ngZone.run(() => {
        if (this.onStatusChange) {
          this.onStatusChange(false);
        }
      });
    }

    try {
      // Load OpenCV.js with retry logic
      console.log('Loading OpenCV.js...');
      try {
        await this.loadOpenCV();
        console.log('OpenCV.js script loaded successfully');
      } catch (loadError) {
        console.error('Failed to load OpenCV.js script:', loadError);
        throw new Error(`Failed to load OpenCV.js: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
      }
      
      // Verify OpenCV object is available
      if (!window.cv) {
        throw new Error('OpenCV.js loaded but window.cv is not available');
      }
      
      console.log('OpenCV object available, checking initialization state...');
      console.log('OpenCV object keys:', Object.keys(window.cv).filter((k: string) => !k.startsWith('_')));
      
      // Log OpenCV version information if available
      if ('version' in window.cv) {
        console.log('OpenCV version:', (window.cv as any).version);
      }
      
      // Wait for OpenCV to be ready with enhanced error reporting
      await new Promise<void>((resolve, reject) => {
        const timeoutMs = 90000; // 90 seconds timeout (increased from 60)
        let isResolved = false;
        let lastCheckTime = startTime;
        let checkCount = 0;

        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            const errorMsg = `OpenCV.js initialization timed out after ${timeoutMs}ms`;
            console.error(errorMsg);
            console.debug('OpenCV object state:', {
              cvExists: !!window.cv,
              cvKeys: window.cv ? Object.keys(window.cv) : [],
              onRuntimeInitialized: window.cv?.onRuntimeInitialized ? 'exists' : 'missing',
              getBuildInformation: window.cv?.getBuildInformation ? 'exists' : 'missing'
            });
            reject(new Error(errorMsg));
          }
        }, timeoutMs);

        const checkInitialized = () => {
          checkCount++;
          try {
            const now = Date.now();
            const elapsed = now - lastCheckTime;
            
            // Log progress every 5 seconds
            if (elapsed > 5000) {
              console.log(`[${new Date().toISOString()}] Still waiting for OpenCV initialization (${Math.round((now - startTime) / 1000)}s elapsed)...`);
              lastCheckTime = now;
              
              // Log detailed state every 15 seconds
              if (elapsed > 15000) {
                console.debug('Current OpenCV state:', {
                  checkCount,
                  elapsed: now - startTime,
                  cvKeys: window.cv ? Object.keys(window.cv).filter(k => !k.startsWith('_')) : [],
                  hasOnRuntimeInitialized: !!(window.cv && 'onRuntimeInitialized' in window.cv),
                  hasGetBuildInfo: !!(window.cv && 'getBuildInformation' in window.cv)
                });
              }
            }

            if (!window.cv) {
              if (now - startTime > timeoutMs) {
                clearTimeout(timeoutId);
                reject(new Error('OpenCV.js not loaded after timeout'));
                return;
              }
              setTimeout(checkInitialized, 100);
              return;
            }

            // Check if OpenCV is already initialized
            if (window.cv.getBuildInformation && typeof window.cv.getBuildInformation === 'function') {
              clearTimeout(timeoutId);
              isResolved = true;
              try {
                const buildInfo = window.cv.getBuildInformation();
                console.log('OpenCV.js loaded successfully');
                console.log('OpenCV build info:', buildInfo);
                
                // Log version information if available
                const versionInfo = 'version' in window.cv ? (window.cv as any).version : 'unknown';
                console.log('OpenCV version:', versionInfo);
                
                // Process build info to show important flags
                const buildFlags = buildInfo.split('\n').filter((line: string) => 
                  line.includes('Version control:') || line.includes('Build type:'));
                console.log('OpenCV build flags:', buildFlags.length > 0 ? buildFlags : 'N/A');
                
                resolve();
              } catch (e) {
                console.warn('Could not get OpenCV build information:', e);
                console.debug('Proceeding with initialization despite missing build info');
                resolve(); // Still resolve if we can't get build info
              }
              return;
            }

            // Set up initialization callback if not already set
            if (window.cv.onRuntimeInitialized) {
              console.log('Setting up OpenCV runtime initialization callback...');
              const originalCallback = window.cv.onRuntimeInitialized;
              window.cv.onRuntimeInitialized = () => {
                try {
                  console.log('OpenCV.js runtime initialization callback triggered');
                  if (originalCallback) {
                    console.log('Calling original callback...');
                    originalCallback();
                  }
                  clearTimeout(timeoutId);
                  isResolved = true;
                  console.log('OpenCV.js runtime initialized successfully');
                  resolve();
                } catch (error) {
                  console.error('Error in OpenCV initialization callback:', error);
                  reject(error);
                }
              };
            } else {
              // Check again shortly
              setTimeout(checkInitialized, 100);
            }
          } catch (error) {
            console.error('Error checking OpenCV initialization:', error);
            clearTimeout(timeoutId);
            reject(error);
          }
        };

        // Start checking
        checkInitialized();
      });

      // Additional check for required OpenCV modules
      console.log('Verifying required OpenCV modules...');
      if (!window.cv) {
        throw new Error('OpenCV.js is not available');
      }
      
      const requiredModules = ['Mat', 'cvtColor'];
      const missingModules = requiredModules.filter(module => !(module in window.cv));
      
      if (missingModules.length > 0) {
        const errorMsg = `OpenCV.js loaded but required modules are missing: ${missingModules.join(', ')}`;
        console.error(errorMsg);
        console.debug('Available OpenCV modules:', Object.keys(window.cv).filter(k => !k.startsWith('_')));
        throw new Error(errorMsg);
      }
      
      console.log('All required OpenCV modules are available');

      // Test basic OpenCV functionality
      try {
        console.log('Testing basic OpenCV functionality...');
        const testMat = new window.cv.Mat();
        if (!testMat || typeof testMat.delete !== 'function') {
          throw new Error('Failed to create OpenCV Mat object');
        }
        testMat.delete();
        console.log('Basic OpenCV functionality test passed');
      } catch (testError) {
        console.error('Basic OpenCV functionality test failed:', testError);
        throw new Error(`OpenCV initialization test failed: ${testError instanceof Error ? testError.message : String(testError)}`);
      }

      OpenCVProcessorService._initialized = true;
      const initTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      this.ngZone.run(() => {
        if (this.onStatusChange) {
          this.onStatusChange(true);
        }
      });
      
      console.log(`OpenCV processor initialized successfully in ${initTime} seconds`);
    } catch (error) {
      console.error('無法加載或初始化 OpenCV.js', error);
      OpenCVProcessorService._initialized = false;
      OpenCVProcessorService.initializationPromise = null; // 允許重試
      if (this.onStatusChange) {
        this.onStatusChange(false);
      }
    }
  }

  async init(): Promise<void> {
    if (OpenCVProcessorService._initialized) {
      return;
    }
    
    // 通知狀態變更
    if (this.onStatusChange) {
      this.onStatusChange(false);
    }
    
    const startTime = performance.now();
    
    try {
      // 確保 OpenCV 已經初始化
      if (!OpenCVProcessorService.initializationPromise) {
        OpenCVProcessorService.initializationPromise = this.initialize();
      }
      
      await OpenCVProcessorService.initializationPromise;
      
      // 執行一個更穩定的測試操作來驗證 OpenCV 是否正常工作
      console.log('Performing test operation to verify OpenCV is working...');
      try {
        // 創建一個小的測試圖像 (1x1 像素)
        const testImage = new ImageData(1, 1);
        testImage.data[0] = 255; // R
        testImage.data[1] = 0;   // G
        testImage.data[2] = 0;   // B
        testImage.data[3] = 255; // A
        
        // 將 ImageData 轉換為 OpenCV Mat
        const src = window.cv.matFromImageData(testImage);
        const dst = new window.cv.Mat();
        
        // 執行色彩空間轉換
        window.cv.cvtColor(src, dst, window.cv.COLOR_RGBA2GRAY, 0);
        
        // 清理資源
        src.delete();
        dst.delete();
        
        console.log('OpenCV test operation completed successfully');
      } catch (testError) {
        console.error('OpenCV test operation failed:', testError);
        throw new Error('OpenCV 功能測試失敗，請確認 OpenCV 已正確載入');
      }
      
      console.log('OpenCV.js 初始化完成');
      this.initializedTime = performance.now() - startTime;
      
      // 通知狀態變更
      if (this.onStatusChange) {
        this.onStatusChange(true);
      }
      
      console.log('OpenCVProcessor 初始化完成，耗時:', this.initializedTime, 'ms');
    } catch (error) {
      console.error('初始化 OpenCV 處理器失敗:', error);
      OpenCVProcessorService._initialized = false;
      OpenCVProcessorService.initializationPromise = null; // 允許重試
      if (this.onStatusChange) {
        this.onStatusChange(false);
      }
      throw error;
    }
  }
  
  private async loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      const existingScript = Array.from(document.scripts).find(
        s => s.src.includes('opencv.js') || s.src.includes('opencv')
      );
      
      if (existingScript) {
        console.log('OpenCV.js script already loaded, reusing');
        // If window.cv exists, resolve immediately
        if (window.cv) {
          console.log('Using existing window.cv object');
          return resolve();
        }
        // Otherwise, wait for the existing script to load
        console.log('Waiting for existing OpenCV.js to initialize...');
        const checkInterval = setInterval(() => {
          if (window.cv) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        // Set a timeout in case the script is broken
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for existing OpenCV.js to initialize'));
        }, 10000);
        return;
      }

      // Load the script if not already loaded
      console.log(`Loading script: ${src}`);
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        console.log(`Script loaded: ${src}`);
        resolve();
      };
      script.onerror = (error) => {
        console.error(`Failed to load script: ${src}`, error);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  private async waitForOpenCV(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        if (window.cv) {
          // Check if OpenCV is already initialized
          if (window.cv.getBuildInformation && typeof window.cv.getBuildInformation === 'function') {
            console.log('OpenCV is already initialized');
            return resolve();
          }
          
          // Set up initialization callback
          if (window.cv.onRuntimeInitialized) {
            const originalCallback = window.cv.onRuntimeInitialized;
            window.cv.onRuntimeInitialized = () => {
              console.log('OpenCV runtime initialized via callback');
              if (originalCallback) originalCallback();
              resolve();
            };
            return;
          }
        }
        
        // Check if we've timed out
        if (Date.now() - startTime > timeoutMs) {
          return reject(new Error(`Timeout waiting for OpenCV to initialize after ${timeoutMs}ms`));
        }
        
        // Check again shortly
        setTimeout(check, 100);
      };
      
      // Start checking
      check();
    });
  }
  
  private checkOpenCVModules(): boolean {
    if (!window.cv) return false;
    
    const requiredModules = ['Mat', 'cvtColor', 'imread', 'imshow'];
    const missingModules = requiredModules.filter(module => !(module in window.cv));
    
    if (missingModules.length > 0) {
      console.warn(`Missing OpenCV modules: ${missingModules.join(', ')}`);
      console.log('Available OpenCV methods:', Object.keys(window.cv).filter(k => !k.startsWith('_')));
      return false;
    }
    
    return true;
  }
  
  async process(imageData: ImageData): Promise<{ result: ImageData; processingTime: number }> {
    if (!OpenCVProcessorService._initialized) {
      await this.init();
    }

    const startTime = performance.now();
    let src: any;
    let dst: any;
    let rgbaDst: any;
    let tempCanvas: HTMLCanvasElement | null = null;
    
    try {
      // 將 ImageData 轉換為 OpenCV 的 Mat 格式
      src = window.cv.matFromImageData(imageData);
      dst = new window.cv.Mat();
      
      // 轉換為灰階
      window.cv.cvtColor(src, dst, window.cv.COLOR_RGBA2GRAY);
      
      // 將灰階轉回 RGBA 以便顯示
      rgbaDst = new window.cv.Mat();
      window.cv.cvtColor(dst, rgbaDst, window.cv.COLOR_GRAY2RGBA);
      
      // 創建一個臨時的 canvas 來處理圖像
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        throw new Error('無法創建臨時 Canvas 2D 上下文');
      }
      
      // 將處理後的數據轉換回 ImageData
      const processedImageData = new ImageData(
        new Uint8ClampedArray(rgbaDst.data),
        rgbaDst.cols,
        rgbaDst.rows
      );
      
      // 繪製處理後的圖像到 canvas
      tempCtx.putImageData(processedImageData, 0, 0);
      
      // 獲取最終的 ImageData
      const result = tempCtx.getImageData(0, 0, imageData.width, imageData.height);
      
      const processingTime = performance.now() - startTime;
      this.lastProcessingTime = processingTime;
      
      return {
        result,
        processingTime
      };
    } catch (error) {
      console.error('OpenCV 處理錯誤:', error);
      throw new Error(`影像處理失敗: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // 確保清理資源
      try {
        if (src && typeof src.delete === 'function') src.delete();
        if (dst && typeof dst.delete === 'function') dst.delete();
        if (rgbaDst && typeof rgbaDst.delete === 'function') rgbaDst.delete();
      } catch (e) {
        console.error('清理資源時出錯:', e);
      }
      
      // 清理 canvas
      if (tempCanvas && tempCanvas.remove) {
        tempCanvas.remove();
      }
    }
  }
  
  isSupported(): boolean {
    // 如果已經初始化完成，則返回 true
    // 否則返回 false 表示支援但尚未初始化完成
    return OpenCVProcessorService._initialized;
  }
  
  getStatus() {
    return {
      initialized: OpenCVProcessorService._initialized,
      lastProcessingTime: this.lastProcessingTime,
      initializedTime: this.initializedTime
    };
  }
}
