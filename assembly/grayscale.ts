// AssemblyScript 灰階處理模組
export function grayscale(
  width: i32,
  height: i32,
  inputPtr: usize,
  outputPtr: usize
): void {
  const length = width * height * 4; // RGBA 4 channels
  
  for (let i = 0; i < length; i += 4) {
    // 獲取像素的 R, G, B 值 (A 通道保持不變)
    const r = load<u8>(inputPtr + i);
    const g = load<u8>(inputPtr + i + 1);
    const b = load<u8>(inputPtr + i + 2);
    
    // 計算灰階值 (使用亮度公式)
    const gray = u8(
      0.299 * f64(r) + 
      0.587 * f64(g) + 
      0.114 * f64(b)
    );
    
    // 設置輸出像素
    store<u8>(outputPtr + i, gray);     // R
    store<u8>(outputPtr + i + 1, gray); // G
    store<u8>(outputPtr + i + 2, gray); // B
    store<u8>(outputPtr + i + 3, load<u8>(inputPtr + i + 3)); // Alpha 通道保持不變
  }
}

// 導出記憶體，讓 JavaScript 可以存取
// 初始 10 頁 (640KB)，最大 100 頁 (6.4MB)
export const memory = new WebAssembly.Memory({ initial: 10, maximum: 100 });
