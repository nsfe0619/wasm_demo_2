const fs = require('fs-extra');
const path = require('path');

const sourceDir = path.join('node_modules', 'wasm-imagemagick', 'dist');
const targetDir = path.join('src', 'assets', 'wasm-imagemagick');

// 確保目標目錄存在
fs.ensureDirSync(targetDir);

// 複製所有檔案
fs.copySync(sourceDir, targetDir, { overwrite: true });

console.log('wasm-imagemagick 檔案已複製到 assets 目錄');
